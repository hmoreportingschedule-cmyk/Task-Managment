let session = null;
const $ = id => document.getElementById(id);
async function api(action, data={}) {
  const body = {action, ...data};
  if(session?.token) body.token = session.token;
  const res = await fetch(window.APP_CONFIG.API_URL, {
    method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify(body)
  });
  const out = await res.json();
  if(!out.ok) throw new Error(out.message || "Request failed");
  return out;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function showPage(id){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(id).classList.remove("hidden");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===id));loadPage(id)}
async function loadPage(id){
  try{
    if(id==="home"){const r=await api("stats");$("statAttendance").textContent=r.attendance;$("statTasks").textContent=r.openTasks;$("statTemplates").textContent=r.templates;$("statRole").textContent=session.role}
    if(id==="attendance") loadAttendance();
    if(id==="tasks") loadTasks();
    if(id==="templates") loadTemplates();
    if(id==="employees" && ["Admin","Master Admin"].includes(session.role)) loadUsers();
  }catch(e){alert(e.message)}
}
async function loadAttendance(){const r=await api("attendance.list"); renderTable("attendanceTable",r.rows)}
async function loadTasks(){const r=await api("tasks.list"); renderTable("tasksTable",r.rows)}
async function loadTemplates(){const r=await api("templates.list"); renderTable("templatesTable",r.rows,["Edit","Delete"])}
async function loadUsers(){const r=await api("users.list"); renderTable("usersTable",r.rows,["Edit"])}
function renderTable(id,rows,actions=[]){
  const t=$(id); if(!rows?.length){t.innerHTML="<tr><td>No records</td></tr>";return}
  const keys=Object.keys(rows[0]); t.innerHTML="<thead><tr>"+keys.map(k=>`<th>${esc(k)}</th>`).join("")+(actions.length?"<th>Action</th>":"")+"</tr></thead><tbody>"+
    rows.map(row=>"<tr>"+keys.map(k=>`<td>${esc(row[k])}</td>`).join("")+(actions.length?`<td>${actions.includes("Edit")?`<button onclick='editRow(${JSON.stringify(row)})'>Edit</button>`:""} ${actions.includes("Delete")?`<button class="ghost" onclick='deleteTemplate("${esc(row.TemplateId)}")'>Delete</button>`:""}</td>`:"")+"</tr>").join("")+"</tbody>";
}
function editRow(row){ if(row.TemplateId!==undefined){$("templateEditor").classList.remove("hidden");$("templateId").value=row.TemplateId;$("templateName").value=row.TemplateName||"";$("templateCategory").value=row.Category||"";$("templatePriority").value=row.Priority||"Normal";$("templateMinutes").value=row.DefaultMinutes||0;$("templateDetails").value=row.Details||""; } else { $("userEditor").classList.remove("hidden"); $("editUserId").value=row.EmployeeId||"";$("uEmpId").value=row.EmployeeId||"";$("uName").value=row.Name||"";$("uLogin").value=row.UserId||"";$("uPassword").value="";$("uRole").value=row.Role||"Employee";$("uIn").value=row.OfficeIn||"";$("uOut").value=row.OfficeOut||"";$("uWeekoff").value=row.Weekoff||"";}}
async function deleteTemplate(id){if(!confirm("Delete this template?"))return;try{await api("templates.delete",{templateId:id});loadTemplates()}catch(e){alert(e.message)}}
$("loginBtn").onclick=async()=>{try{const r=await api("login",{userId:$("loginId").value.trim(),password:$("loginPassword").value});session=r.user;session.token=r.token;localStorage.setItem("tm_session",JSON.stringify(session));$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("userName").textContent=session.name;$("roleBadge").textContent=" • "+session.role;document.querySelectorAll(".adminOnly").forEach(x=>x.classList.toggle("hidden",!["Admin","Master Admin"].includes(session.role)));document.querySelectorAll(".adminOrHod").forEach(x=>x.classList.toggle("hidden",!["Admin","Master Admin","HOD"].includes(session.role)));showPage("home")}catch(e){$("loginMsg").textContent=e.message}}
$("logoutBtn").onclick=()=>{localStorage.removeItem("tm_session");location.reload()}
document.querySelectorAll(".nav").forEach(x=>x.onclick=()=>showPage(x.dataset.page));
$("saveAttendance").onclick=async()=>{try{await api("attendance.save",{date:$("attDate").value,inTime:$("attIn").value,outTime:$("attOut").value,taskMinutes:$("attTaskMinutes").value,breakMinutes:$("attBreak").value,weekoff:$("attWeekoff").value});$("attendanceMsg").textContent="Attendance saved.";loadAttendance()}catch(e){$("attendanceMsg").textContent=e.message}}
$("saveTask").onclick=async()=>{try{await api("tasks.save",{employeeId:$("taskEmployeeId").value,taskName:$("taskName").value,details:$("taskDetails").value,priority:$("taskPriority").value,dueDate:$("taskDueDate").value,taskMinutes:$("taskMinutes").value});$("taskMsg").textContent="Task assigned.";loadTasks()}catch(e){$("taskMsg").textContent=e.message}}
$("newTemplate").onclick=()=>{$("templateEditor").classList.remove("hidden");["templateId","templateName","templateCategory","templateMinutes","templateDetails"].forEach(id=>$(id).value="");$("templatePriority").value="Normal"}
$("cancelTemplate").onclick=()=>$("templateEditor").classList.add("hidden");
$("saveTemplate").onclick=async()=>{try{await api("templates.save",{templateId:$("templateId").value,templateName:$("templateName").value,category:$("templateCategory").value,priority:$("templatePriority").value,defaultMinutes:$("templateMinutes").value,details:$("templateDetails").value});$("templateEditor").classList.add("hidden");loadTemplates()}catch(e){alert(e.message)}}
$("newUser").onclick=()=>{$("userEditor").classList.remove("hidden");["editUserId","uEmpId","uName","uLogin","uPassword","uIn","uOut","uWeekoff"].forEach(id=>$(id).value="");$("uRole").value="Employee"}
$("cancelUser").onclick=()=>$("userEditor").classList.add("hidden");
$("saveUser").onclick=async()=>{try{await api("users.save",{employeeId:$("uEmpId").value,name:$("uName").value,userId:$("uLogin").value,password:$("uPassword").value,role:$("uRole").value,officeIn:$("uIn").value,officeOut:$("uOut").value,weekoff:$("uWeekoff").value});$("userMsg").textContent="User saved.";loadUsers()}catch(e){$("userMsg").textContent=e.message}}
$("refreshAttendance").onclick=loadAttendance;$("refreshTasks").onclick=loadTasks;
$("attDate").value=new Date().toISOString().slice(0,10);
try{const s=JSON.parse(localStorage.getItem("tm_session"));if(s?.token){session=s;$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("userName").textContent=s.name;$("roleBadge").textContent=" • "+s.role;document.querySelectorAll(".adminOnly").forEach(x=>x.classList.toggle("hidden",!["Admin","Master Admin"].includes(s.role)));showPage("home")}}catch{}
