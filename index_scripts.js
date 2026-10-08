



        // YAHAN APNA NAYA GOOGLE SCRIPT URL DAALEIN
        // GOOGLE SHEET / APPS SCRIPT URL: Is URL ko change karein agar Web App deployment URL badle.
        const DEFAULT_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9x_CwQz3CAQFSZENxZ6tFwTETOv-vol39dGDR5-A0cFj-pvbgd5_HI_1vLLm5yOxG4Q/exec";
        // Hosting-neutral configuration: the same frontend works on Vercel, Cloudflare Pages,
        // GitHub Pages/static hosting, etc. Optionally override the API URL via:
        // window.__TASK_APP_CONFIG = { googleScriptUrl: "https://.../exec" };
        // or <meta name="google-script-url" content="https://.../exec"> in index.html.
        const GOOGLE_SCRIPT_URL = (window.__TASK_APP_CONFIG && window.__TASK_APP_CONFIG.googleScriptUrl)
            || document.querySelector('meta[name="google-script-url"]')?.content
            || DEFAULT_GOOGLE_SCRIPT_URL;
        
        let globalAllTasks = []; 
        let globalTeamMembers = [];
        let globalTeamMemberMeta = [];
        let globalMonthlyFullAttendance = [];
        let ramadanLunchFrozen = false; 
        let globalWorkLogs = [];
        let globalTeamAttendance = [];
        let monthlyChartInst = null;
        let dashboardSyncInProgress = false;
        let sessionToken = "";
        let whatsappGroupLink = "";
        let attendanceEntryStart = "";
        let attendanceEntryEnd = "";
        let globalAdvanceScheduleRequests = [];
        let globalAttendanceRequests = [];
        let globalOfficeEvents = [];
        let v4CurrentWeekoff = "Sunday";
        let performanceWeights = {attendance:50, task:50};
        let globalAttendanceDateLocks = [];
        // Temporary date baseline: Attendance/Task entry is allowed from 01-Oct-2026 onward.
        // Admin Lock/Unlock remains the authority for older/current dates.
        const ENTRY_BASELINE_DATE = "2026-10-01";

        // V.14 hosting compatibility: do not use Vercel/Cloudflare-specific APIs.
        // All backend calls remain standard browser fetch() POST requests to Apps Script.
        const APP_HOSTING_PLATFORM = /(^|\.)vercel\.app$/i.test(location.hostname) ? 'vercel'
            : (/^(pages\.|.*\.)?cloudflarepages\.dev$/i.test(location.hostname) || /\.workers\.dev$/i.test(location.hostname) ? 'cloudflare' : 'static');


function formatDailyActionDateDisplay_(dateKey){
    const s=String(dateKey||'').trim();
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return s;
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${Number(m[3])}-${months[Number(m[2])-1]}-${m[1]}`;
}
function upgradeDailyActionDatePicker_(){
    const el=document.getElementById('attendanceDate');
    if(!el || el.dataset.displayUpgraded==='1')return;
    el.dataset.displayUpgraded='1';
    const originalType=el.type;
    const wrap=document.createElement('div');
    wrap.className='relative';
    const display=document.createElement('input');
    display.type='text';
    display.id='attendanceDateDisplay';
    display.readOnly=true;
    display.className=el.className || 'w-full border rounded-lg p-2';
    display.setAttribute('aria-label','Select Date');
    display.placeholder='5-Oct-2026';
    const icon=document.createElement('span');
    icon.innerHTML='📅';
    icon.style.cssText='position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:14px;';
    const picker=el.cloneNode(true);
    picker.id='attendanceDatePicker';
    picker.type='date';
    picker.className='absolute inset-0 w-full h-full opacity-0 cursor-pointer';
    picker.style.zIndex='2';
    wrap.appendChild(display);
    wrap.appendChild(icon);
    wrap.appendChild(picker);
    el.type='hidden';
    el.parentNode.insertBefore(wrap,el);
    function sync(){
        display.value=formatDailyActionDateDisplay_(el.value);
        picker.value=el.value||'';
        picker.min=el.min||'';
        picker.max=el.max||'';
        picker.disabled=false;
    }
    picker.addEventListener('change',function(){
        el.value=picker.value;
        sync();
        el.dispatchEvent(new Event('change',{bubbles:true}));
    });
    display.addEventListener('click',function(){try{picker.showPicker();}catch(e){picker.focus();}});
    wrap.addEventListener('click',function(e){
        if(e.target===display || e.target===icon){try{picker.showPicker();}catch(err){picker.focus();}}
    });
    sync();
}

        function setDateConstraints() {
            const dateInput = document.getElementById('attendanceDate');
            if(!dateInput) return;
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const tzOffset = today.getTimezoneOffset() * 60000;
            const localToday = (new Date(today - tzOffset)).toISOString().split('T')[0];
            const localYesterday = (new Date(yesterday - tzOffset)).toISOString().split('T')[0];
            const twoDaysAgo = new Date(today); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const localTwoDaysAgo = (new Date(twoDaysAgo - tzOffset)).toISOString().split('T')[0];
            // Previous-date restriction is disabled for the temporary period
            // starting 01-Oct-2026. The calendar remains selectable; future
            // dates are still blocked and Admin Lock/Unlock remains authoritative.
            dateInput.min = ENTRY_BASELINE_DATE;
            dateInput.max = localToday;
            dateInput.disabled = false;
            dateInput.readOnly = false;
            // Preserve the employee's currently selected previous date.
            // Only initialize/reset when the value is missing or outside the
            // global selectable window; Admin Lock/Unlock is checked separately.
            const currentSelected=String(dateInput.value||'').trim();
            if(!currentSelected || currentSelected<ENTRY_BASELINE_DATE || currentSelected>localToday){
                dateInput.value=localToday;
            }
            if(typeof updateAttendanceNonWorkingDay==='function')updateAttendanceNonWorkingDay();
            if(typeof upgradeDailyActionDatePicker_==='function')upgradeDailyActionDatePicker_();
            const adp=document.getElementById('attendanceDatePicker'), adDisplay=document.getElementById('attendanceDateDisplay');
            if(adp){adp.value=dateInput.value||'';adp.min=dateInput.min||'';adp.max=dateInput.max||'';adp.disabled=false;}
            if(adDisplay)adDisplay.value=formatDailyActionDateDisplay_(dateInput.value);
        }

        function updateLiveTime() {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0'); 
            const year = now.getFullYear();
            let h = now.getHours();
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12; h = h ? h : 12;
            const formattedTime = `${String(h).padStart(2, '0')}:${m}:${s} ${ampm}`;
            
            document.getElementById('currentDate').innerText = `${day}-${month}-${year}`;
            document.getElementById('currentTime').innerText = formattedTime;
        }
        setInterval(updateLiveTime, 1000); updateLiveTime();

        // 60 SECONDS AUTO SYNC — reduces unnecessary Apps Script calls while keeping data fresh.
        setInterval(() => {
            if(document.getElementById('dashboard-section').style.display === 'flex') {
                fetchDashboardDataSilently();
            }
        }, 60000);

        function v4UpdateAttendanceAvailability(){
            const el=document.getElementById('attendanceDate'), notice=document.getElementById('attendanceClosedNotice'), btn=document.getElementById('attendanceBtn');
            if(!el||!notice||!btn)return;
            const key=el.value,dt=key?new Date(key+'T12:00:00'):null;
            const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const weekoffs=String(v4CurrentWeekoff||'Sunday').split(/[,;/]/).map(x=>x.trim().toLowerCase());
            const event=key?(globalOfficeEvents||[]).find(e=>key>=String(e.fromDate||'')&&key<=String(e.toDate||e.fromDate||'')):null;
            const isWeekoff=dt&&weekoffs.includes(names[dt.getDay()].toLowerCase());
            const lockState=applyAttendanceLockUI(key); const msg=lockState.locked?'Admin ne is date/month ko LOCK kiya hua hai. Attendance/Breaks ke liye pehle UNLOCK zaroori hai.':event?'Aaj office band hai: '+String(event.name||event.eventName||'Holiday')+'. Attendance ki zaroorat nahi.':isWeekoff?'Today Weekoff':'';
            notice.textContent=msg;notice.classList.toggle('hidden',!msg);btn.disabled=!!msg;btn.style.opacity=msg?'0.5':'';btn.title=msg;
        }
        let pendingBreakAction = '';
        let pendingBreakReason = '';

        document.addEventListener('change',e=>{
            if(e.target&&e.target.id==='attendanceDate'){
                clearPendingBreakAction();
                v4UpdateAttendanceAvailability();
                updateAttendanceReasonUI();
                updateBreakTypeOptions();
            }
            if(e.target&&e.target.id==='attendanceAction'){
                clearPendingBreakAction();
                toggleInputs();
                updateAttendanceReasonUI();
                updateAttendanceTimingReasonUI();
            }
            if(e.target&&e.target.id==='namazTypeSelect'){
                selectNamazBreakType();
                updateBreakTypeOptions();
            }
        });
        document.addEventListener('input',e=>{if(e.target&&e.target.id==='manualTime'){updateBreakExtraReasonVisibility();updateAttendanceTimingReasonUI();}});

        function clearPendingBreakAction(){
            pendingBreakAction='';
            pendingBreakReason='';
            const el=document.getElementById('breakActionState'); if(el)el.value='';
        }
        function setBreakActionFromField(reasonType, action, fieldId){
            if(reasonType==='Lunch' && typeof ramadanLunchFrozen!=='undefined' && ramadanLunchFrozen){
                const field=document.getElementById(fieldId); if(field)field.value='';
                alert('Ramadan mein Lunch option Admin ne freeze kiya hua hai.');
                clearPendingBreakAction();
                return;
            }
            if(reasonType==='Namaz' && !getSelectedNamazType()){
                const field=document.getElementById(fieldId); if(field)field.value='';
                alert('Pehle Namaz select karein.');
                clearPendingBreakAction();
                return;
            }
            const value=document.getElementById(fieldId)?.value||'';
            if(!value){ clearPendingBreakAction(); return; }
            pendingBreakAction=action;
            pendingBreakReason=reasonType;
            const state=document.getElementById('breakActionState'); if(state)state.value=action;
            const manual=document.getElementById('manualTime'); if(manual)manual.value=value;
            updateBreakExtraReasonVisibility();
        }
        function toggleInputs() {
            const timeBox = document.getElementById('manualTimeBox');
            if (timeBox) timeBox.classList.remove('hidden');
        }
        const _attendanceActionEl = document.getElementById('attendanceAction');
        if (_attendanceActionEl) {
            if (!_attendanceActionEl.value) _attendanceActionEl.value = 'Punch In';
            _attendanceActionEl.classList.remove('hidden');
        }
        const _manualTimeBoxEl = document.getElementById('manualTimeBox');
        if (_manualTimeBoxEl) _manualTimeBoxEl.classList.remove('hidden');
        toggleInputs(); updateAttendanceReasonUI(); updateAttendanceTimingReasonUI();

        function getSelectedAttendanceDate(){ return document.getElementById('attendanceDate')?.value || ''; }
        function isFridaySelected(){ const d=getSelectedAttendanceDate(); if(!d)return false; const dt=new Date(d+'T12:00:00'); return !Number.isNaN(dt.getTime()) && dt.getDay()===5; }
        function updateBreakTypeOptions(){
            const sel=document.getElementById('namazTypeSelect'); if(!sel)return;
            const friday=isFridaySelected();
            const current=sel.value;
            // Friday: show Juma, Asr, Magrib; hide Zohar.
            // Other days: show Zohar, Asr, Magrib; hide Juma.
            const options = friday
                ? [['Juma','Juma'],['Asr','Asr'],['Magrib','Magrib']]
                : [['Zohar','Zohar'],['Asr','Asr'],['Magrib','Magrib']];
            sel.innerHTML = '<option value="">-- Select Namaz --</option>' + options.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('');
            sel.value = options.some(x=>x[0]===current) ? current : '';
            const hint=document.getElementById('namazDayHint');
            if(hint) hint.textContent = friday ? 'Friday: Juma, Asr ya Magrib select kar sakte hain.' : 'Working Day: Zohar, Asr ya Magrib select kar sakte hain.';
        }
        function selectNamazBreakType(){
            const val=document.getElementById('namazTypeSelect')?.value||'';
            if(!val)return;
            document.getElementById('actionReasonSelect').value='Namaz';
            const activeField=pendingBreakAction==='Break End'?'namazBreakEndTime':pendingBreakAction==='Break Start'?'namazBreakStartTime':'';
            if(activeField){
                const time=document.getElementById(activeField)?.value||'';
                if(time) document.getElementById('manualTime').value=time;
            }
            updateBreakExtraReasonVisibility();
        }
        function selectBreakTiming(type){
            document.getElementById('actionReasonSelect').value=type;
            updateBreakExtraReasonVisibility();
        }
        function selectNamazType(type){
            const sel=document.getElementById('namazTypeSelect'); if(sel)sel.value=type;
            selectNamazBreakType();
        }
        function getSelectedNamazType(){ return document.getElementById('namazTypeSelect')?.value || ''; }
        function toggleOtherReason() {
            const val = document.getElementById('actionReasonSelect')?.value || '';
            const other = document.getElementById('actionReasonOther');
            if(other && val!=='Other' && !other.value.trim()) other.value='';
            updateBreakTypeOptions();
            updateBreakExtraReasonVisibility();
        }
        function getBreakPolicyForSelection(){
            const type=document.getElementById('actionReasonSelect')?.value||'';
            if(type==='Lunch') return {label:'Lunch',max:25};
            if(type==='Namaz'){
                const n=getSelectedNamazType();
                if(n==='Juma')return {label:'Juma',max:70};
                return {label:n==='Zohar'?'Namaz - Zohar':'Namaz',max:25};
            }
            return null;
        }
function parseBreakTimeClient(v){
            if(!v)return null; const m=String(v).trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i); if(!m)return null;
            let h=Number(m[1]),mi=Number(m[2]); const ap=(m[3]||'').toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0; return h*60+mi;
        }
        function getOpenBreakStartForDate(){
            const date=getSelectedAttendanceDate(); if(!date)return null;
            const rec=(globalMonthlyFullAttendance||[]).find(a=>{ const raw=String(a.Date||'').trim(); let key=raw; if(/^\d{2}-\d{2}-\d{4}$/.test(raw)){const p=raw.split('-');key=`${p[2]}-${p[1]}-${p[0]}`;} return key===date && String(a.Employee||'').toLowerCase()===String(document.getElementById('displayUser')?.innerText||'').toLowerCase(); });
            if(!rec)return null;
            const bs=String(rec.BreakStarts||'').split('|').map(x=>x.trim()).filter(Boolean), be=String(rec.BreakEnds||'').split('|').map(x=>x.trim()).filter(Boolean);
            if(bs.length>be.length)return parseBreakTimeClient(bs[bs.length-1]);
            return null;
        }
        function updateBreakExtraReasonVisibility(){
            const wrap=document.getElementById('extraBreakReasonBox'), text=document.getElementById('extraBreakLimitText');
            if(!wrap)return;
            const action=pendingBreakAction || document.getElementById('attendanceAction')?.value||'';
            if(action!=='Break End'){wrap.classList.add('hidden');if(text)text.innerText='';return;}
            const policy=getBreakPolicyForSelection(), start=getOpenBreakStartForDate(), end=parseBreakTimeClient(document.getElementById('manualTime')?.value||'');
            if(!policy || start===null || end===null){wrap.classList.add('hidden');if(text)text.innerText='';return;}
            let mins=end-start;if(mins<0)mins+=1440;
            if(mins>policy.max){wrap.classList.remove('hidden');if(text)text.innerText=`Allowed ${policy.max} minutes. Actual ${mins} minutes. Extra ${mins-policy.max} minutes duty mein count nahi honge.`;}else{wrap.classList.add('hidden');if(text)text.innerText='';document.getElementById('extraBreakReason').value='';}
        }
        function updateAttendanceReasonUI(){ toggleOtherReason(); updateBreakTypeOptions(); }

        function formatTime12h(time24) {
            if(!time24) return "";
            let [h, m] = time24.split(':');
            let ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
        }

        function timeToMins(timeStr) {
            if(!timeStr) return 0;
            timeStr = timeStr.trim();
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':');
            if(!hours || !minutes) return 0;
            if (hours === '12') hours = '00';
            if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
            return (parseInt(hours, 10) * 60) + parseInt(minutes, 10);
        }

        function showLoginStatus(message,type){const box=document.getElementById('loginStatus');if(!box)return;box.className='login-status '+(type||'error');box.innerHTML=message;}
        function handleLogin(event) {
            event.preventDefault();
            if(GOOGLE_SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE"){ showLoginStatus('Please update the Google Apps Script Web App URL first.','error'); return; }
            const user=document.getElementById('username').value.trim(), pass=document.getElementById('password').value, btn=document.getElementById('loginBtn');
            showLoginStatus('<span class="login-spinner"></span>Secure login check ho raha hai…','info'); btn.innerHTML='<span class="login-spinner"></span>Authenticating…'; btn.disabled=true;
            const formData=new FormData(); formData.append('action','login'); formData.append('username',user); formData.append('password',pass);
            const controller=new AbortController(), timeoutId=setTimeout(()=>controller.abort(),30000);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:formData,cache:'no-store',signal:controller.signal,credentials:'omit'})
            .then(res=>{if(!res.ok)throw new Error('HTTP '+res.status);return res.json();})
            .then(data=>{
                if(data.status!=='success'){
                    const msg=data.code==='WEB_LINK_OFF' ? '🔒 '+(data.message||'Aapka Web Link access abhi OFF hai.') : '❌ '+(data.message||'Aap ne galat User ID ya Password add kiya hai.');
                    showLoginStatus(msg,'error');btn.innerHTML='Login to Dashboard <i class="fas fa-arrow-right ml-2"></i>';btn.disabled=false;return;
                }
                showLoginStatus('Login successful. Dashboard load ho raha hai…','info');
                document.getElementById('login-section').style.display='none'; document.getElementById('dashboard-section').style.display='flex';
                sessionToken=data.sessionToken||""; whatsappGroupLink=data.whatsappGroupLink||"";
                persistLoginSession_(data,user); startInactivitySessionTimer_(); performanceWeights=data.performanceWeights||{attendance:50,task:50}; ramadanLunchFrozen=!!data.ramadanLunchFrozen; attendanceEntryStart=data.attendanceEntryStart||""; attendanceEntryEnd=data.attendanceEntryEnd||"";
                setDateConstraints(); document.getElementById('displayUser').innerText=data.actualName||data.username; window.currentUserContactNumber=data.contactNumber||''; window.currentUserWhatsappNumber=data.whatsappNumber||''; window.currentUserEmployeeId=data.employeeId||'';
                document.getElementById('displayDept').innerText=data.department||'--'; document.getElementById('displayOfficeTime').innerText=data.officeTime||'--'; window.currentUserWeekoff=data.weekoff||'Sunday'; document.getElementById('displayWeekoff').innerText=data.weekoff||'Sunday';
                document.getElementById('displayOfficeLocation').innerText=[data.officeLocation,data.officeAddress].filter(Boolean).join(' : ')||'--'; setDisplayedProfilePhoto(data.profilePhotoUrl||'');
                const role=String(data.role||'').toLowerCase(); document.getElementById('displayRole').innerText=role;
                document.body.classList.remove('employee-mode','manager-mode','admin-mode');
                if(isFullAdminRole(role)){
                    document.body.classList.add('admin-mode');
                    document.getElementById('progressReportAttWeight')?.removeAttribute('readonly'); document.getElementById('progressReportTaskWeight')?.removeAttribute('readonly'); document.getElementById('attendanceWeightage')?.removeAttribute('readonly'); document.getElementById('taskWeightage')?.removeAttribute('readonly');
                    document.querySelectorAll('#progressReportAttWeight,#progressReportTaskWeight,#attendanceWeightage,#taskWeightage').forEach(el=>{el.classList.remove('bg-gray-100','cursor-not-allowed');});
                    document.querySelectorAll('.admin-only').forEach(el=>el.style.setProperty('display','flex','important')); document.querySelectorAll('.hod-only').forEach(el=>el.style.setProperty('display','flex','important')); const actionHdr=document.getElementById('taskActionHeader'); if(actionHdr) actionHdr.style.display='table-cell';
                    document.getElementById('hodNoticeBox').style.display='block'; document.getElementById('teamAttendanceSection').style.display='block'; const rlf=document.getElementById('ramadanLunchFreeze'); if(rlf) rlf.checked=!!ramadanLunchFrozen; document.getElementById('taskTableTitle').innerText='System Overview';
                    document.querySelectorAll('.hod-only-col').forEach(el=>el.classList.remove('hidden')); document.querySelectorAll('.emp-only').forEach(el=>el.style.setProperty('display','none','important'));
                } else if(isTaskAssistantRole(role)){
                    document.body.classList.add('manager-mode');
                    document.querySelectorAll('.hod-only').forEach(el=>el.style.setProperty('display','flex','important'));
                    document.querySelectorAll('.admin-only').forEach(el=>el.style.setProperty('display','none','important')); const actionHdr=document.getElementById('taskActionHeader'); if(actionHdr) actionHdr.style.display='none';
                    document.getElementById('hodNoticeBox').style.display='block';
                    document.getElementById('teamAttendanceSection').style.display='block';
                    document.getElementById('taskTableTitle').innerText='System Overview';
                    document.querySelectorAll('.hod-only-col').forEach(el=>el.classList.remove('hidden'));
                    document.querySelectorAll('.emp-only').forEach(el=>el.style.setProperty('display','none','important'));
                } else if(role.indexOf('hod')>-1){
                    document.body.classList.add('manager-mode');
                    document.querySelectorAll('.hod-only').forEach(el=>el.style.setProperty('display','flex','important')); document.getElementById('hodNoticeBox').style.display='block'; document.getElementById('teamAttendanceSection').style.display='block'; document.getElementById('taskTableTitle').innerText='Department Tasks Overview';
                    document.querySelectorAll('.hod-only-col').forEach(el=>el.classList.remove('hidden')); document.querySelectorAll('.emp-only').forEach(el=>el.style.setProperty('display','none','important')); document.querySelectorAll('.admin-only').forEach(el=>el.style.setProperty('display','none','important')); const actionHdr=document.getElementById('taskActionHeader'); if(actionHdr) actionHdr.style.display='none';
                } else {
                    document.body.classList.add('employee-mode');
                    document.querySelectorAll('.hod-only').forEach(el=>el.style.setProperty('display','none','important')); document.querySelectorAll('.admin-only').forEach(el=>el.style.setProperty('display','none','important')); document.querySelectorAll('.emp-only').forEach(el=>el.style.setProperty('display','block','important')); document.getElementById('empTimeTracker').style.display='flex';
                }
                v4CurrentWeekoff=data.weekoff||'Sunday';ensureAttendanceLockAdminUI();addRefreshButton_();requestAnimationFrame(()=>fetchDashboardData(data.username||user,role,data.department||''));setTimeout(v4UpdateAttendanceAvailability,100);
            })
            .catch(err=>{showLoginStatus(err&&err.name==='AbortError'?'⏱️ Server response mein zyada time lag raha hai. Please 10–15 seconds baad dobara try karein.':'⚠️ Server se connection nahi ho pa raha. Please connection check karke dobara try karein.','error');btn.innerHTML='Login to Dashboard <i class="fas fa-arrow-right ml-2"></i>';btn.disabled=false;})
            .finally(()=>clearTimeout(timeoutId));
        }

        const LOGIN_SESSION_STORAGE_KEY_ = 'office_task_login_session_v1';
        const LOGIN_IDLE_LIMIT_MS_ = 3 * 60 * 1000;
        const LOGIN_ACTIVITY_WRITE_MS_ = 15000;
        let loginIdleTimer_ = null;
        let lastLoginActivityWrite_ = 0;

        function persistLoginSession_(data, fallbackUsername){
            try{
                const payload={
                    sessionToken:String(data.sessionToken||''),
                    username:String(data.username||fallbackUsername||''),
                    actualName:String(data.actualName||data.username||fallbackUsername||''),
                    role:String(data.role||''),
                    department:String(data.department||''),
                    contactNumber:String(data.contactNumber||''),
                    whatsappNumber:String(data.whatsappNumber||''),
                    employeeId:String(data.employeeId||''),
                    officeTime:String(data.officeTime||''),
                    weekoff:String(data.weekoff||'Sunday'),
                    officeLocation:String(data.officeLocation||''),
                    officeAddress:String(data.officeAddress||''),
                    profilePhotoUrl:String(data.profilePhotoUrl||''),
                    performanceWeights:data.performanceWeights||{attendance:50,task:50},
                    ramadanLunchFrozen:!!data.ramadanLunchFrozen,
                    attendanceEntryStart:String(data.attendanceEntryStart||''),
                    attendanceEntryEnd:String(data.attendanceEntryEnd||''),
                    whatsappGroupLink:String(data.whatsappGroupLink||''),
                    lastActivityAt:Date.now()
                };
                localStorage.setItem(LOGIN_SESSION_STORAGE_KEY_,JSON.stringify(payload));
                lastLoginActivityWrite_=Date.now();
            }catch(e){}
        }
        function getPersistedLoginSession_(){
            try{
                const raw=localStorage.getItem(LOGIN_SESSION_STORAGE_KEY_);
                if(!raw)return null;
                const p=JSON.parse(raw);
                if(!p||!p.sessionToken||!p.username)return null;
                if(Date.now()-Number(p.lastActivityAt||0)>=LOGIN_IDLE_LIMIT_MS_){
                    clearPersistedLoginSession_();
                    return null;
                }
                return p;
            }catch(e){return null;}
        }
        function touchLoginActivity_(){
            if(!sessionToken)return;
            const now=Date.now();
            if(now-lastLoginActivityWrite_<LOGIN_ACTIVITY_WRITE_MS_)return;
            lastLoginActivityWrite_=now;
            try{
                const raw=localStorage.getItem(LOGIN_SESSION_STORAGE_KEY_);
                const p=raw?JSON.parse(raw):null;
                if(p&&p.sessionToken===sessionToken){
                    p.lastActivityAt=now;
                    localStorage.setItem(LOGIN_SESSION_STORAGE_KEY_,JSON.stringify(p));
                }
            }catch(e){}
        }
        function clearPersistedLoginSession_(){
            try{localStorage.removeItem(LOGIN_SESSION_STORAGE_KEY_);}catch(e){}
        }
        function stopInactivitySessionTimer_(){
            if(loginIdleTimer_){clearInterval(loginIdleTimer_);loginIdleTimer_=null;}
        }
        function expireInactiveSession_(){
            clearPersistedLoginSession_();
            stopInactivitySessionTimer_();
            sessionToken='';
            try{localStorage.removeItem('office_task_dashboard_cache_v2_'+String(document.getElementById('displayUser')?.innerText||'').trim().toLowerCase());}catch(e){}
            alert('3 minutes se koi activity nahi hui. Security ke liye session expire ho gaya hai. Please dobara Login karein.');
            location.reload();
        }
        function startInactivitySessionTimer_(){
            stopInactivitySessionTimer_();
            if(!sessionToken)return;
            loginIdleTimer_=setInterval(()=>{
                try{
                    const raw=localStorage.getItem(LOGIN_SESSION_STORAGE_KEY_);
                    const p=raw?JSON.parse(raw):null;
                    if(!p||p.sessionToken!==sessionToken||Date.now()-Number(p.lastActivityAt||0)>=LOGIN_IDLE_LIMIT_MS_){
                        expireInactiveSession_();
                    }
                }catch(e){}
            },10000);
        }
        function addRefreshButton_(){
            if(document.getElementById('login-section')?.style.display!=='none')return;
            if(document.getElementById('appRefreshButton'))return;
            const btn=document.createElement('button');
            btn.id='appRefreshButton';
            btn.type='button';
            btn.innerHTML='<i class="fas fa-sync-alt"></i><span> Refresh</span>';
            btn.title='Latest version/data load karein';
            btn.style.cssText='border:0;border-radius:8px;padding:8px 12px;background:#0f766e;color:#fff;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.14);cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin-right:8px;';
            btn.addEventListener('click',function(){
                touchLoginActivity_();
                btn.disabled=true;
                btn.innerHTML='<i class="fas fa-sync-alt fa-spin"></i><span> Refreshing...</span>';
                setTimeout(()=>location.reload(),120);
            });
            const notificationBtn=document.getElementById('notificationBtn');
            if(notificationBtn && notificationBtn.parentElement){
                const parent=notificationBtn.parentElement;
                if(!parent.style.display)parent.style.display='flex';
                parent.style.alignItems='center';
                notificationBtn.parentElement.insertBefore(btn,notificationBtn);
            }else{
                // Notification button may be rendered slightly later.
                const host=document.getElementById('dashboard-section');
                if(host){
                    btn.style.position='fixed';btn.style.top='14px';btn.style.right='18px';btn.style.zIndex='9998';
                    host.appendChild(btn);
                }
            }
        }
        function applyRestoredSession_(p){
            sessionToken=p.sessionToken||'';
            whatsappGroupLink=p.whatsappGroupLink||'';
            performanceWeights=p.performanceWeights||{attendance:50,task:50};
            ramadanLunchFrozen=!!p.ramadanLunchFrozen;
            attendanceEntryStart=p.attendanceEntryStart||'';
            attendanceEntryEnd=p.attendanceEntryEnd||'';
            document.getElementById('login-section').style.display='none';
            document.getElementById('dashboard-section').style.display='flex';
            document.getElementById('displayUser').innerText=p.actualName||p.username;
            document.getElementById('displayDept').innerText=p.department||'--';
            document.getElementById('displayOfficeTime').innerText=p.officeTime||'--';
            document.getElementById('displayWeekoff').innerText=p.weekoff||'Sunday';
            document.getElementById('displayOfficeLocation').innerText=[p.officeLocation,p.officeAddress].filter(Boolean).join(' : ')||'--';
            document.getElementById('displayRole').innerText=String(p.role||'').toLowerCase();
            window.currentUserContactNumber=p.contactNumber||'';
            window.currentUserWhatsappNumber=p.whatsappNumber||'';
            window.currentUserEmployeeId=p.employeeId||'';
            window.currentUserWeekoff=p.weekoff||'Sunday';
            setDisplayedProfilePhoto(p.profilePhotoUrl||'');
            const role=String(p.role||'').toLowerCase();
            document.body.classList.remove('employee-mode','manager-mode','admin-mode');
            if(isFullAdminRole(role)){
                document.body.classList.add('admin-mode');
                document.querySelectorAll('.admin-only').forEach(el=>el.style.setProperty('display','flex','important'));
                document.querySelectorAll('.hod-only').forEach(el=>el.style.setProperty('display','flex','important'));
                const h=document.getElementById('taskActionHeader');if(h)h.style.display='table-cell';
                document.getElementById('hodNoticeBox').style.display='block';
                document.getElementById('teamAttendanceSection').style.display='block';
                document.getElementById('taskTableTitle').innerText='System Overview';
                document.querySelectorAll('.hod-only-col').forEach(el=>el.classList.remove('hidden'));
                document.querySelectorAll('.emp-only').forEach(el=>el.style.setProperty('display','none','important'));
            }else if(isTaskAssistantRole(role)||role.indexOf('hod')>-1){
                document.body.classList.add('manager-mode');
                document.querySelectorAll('.hod-only').forEach(el=>el.style.setProperty('display','flex','important'));
                document.querySelectorAll('.admin-only').forEach(el=>el.style.setProperty('display','none','important'));
                const h=document.getElementById('taskActionHeader');if(h)h.style.display='none';
                document.getElementById('hodNoticeBox').style.display='block';
                document.getElementById('teamAttendanceSection').style.display='block';
                document.getElementById('taskTableTitle').innerText=role.indexOf('hod')>-1?'Department Tasks Overview':'System Overview';
                document.querySelectorAll('.hod-only-col').forEach(el=>el.classList.remove('hidden'));
                document.querySelectorAll('.emp-only').forEach(el=>el.style.setProperty('display','none','important'));
                document.querySelectorAll('.admin-only').forEach(el=>el.style.setProperty('display','none','important'));
            }else{
                document.body.classList.add('employee-mode');
                document.querySelectorAll('.hod-only').forEach(el=>el.style.setProperty('display','none','important'));
                document.querySelectorAll('.admin-only').forEach(el=>el.style.setProperty('display','none','important'));
                document.querySelectorAll('.emp-only').forEach(el=>el.style.setProperty('display','block','important'));
                document.getElementById('empTimeTracker').style.display='flex';
            }
            v4CurrentWeekoff=p.weekoff||'Sunday';
            ensureAttendanceLockAdminUI();
            addRefreshButton_();
            startInactivitySessionTimer_();
            requestAnimationFrame(()=>fetchDashboardData(p.username||'',role,p.department||''));
            setTimeout(v4UpdateAttendanceAvailability,100);
        }
        function restorePersistedSession_(){
            const p=getPersistedLoginSession_();
            if(!p)return;
            applyRestoredSession_(p);
        }

        function logout() {
            clearPersistedLoginSession_();
            stopInactivitySessionTimer_();
            sessionToken='';
            location.reload();
        }


        // V4: display non-working day before a network request; server also validates.
        function updateAttendanceNonWorkingDay(){
            const field=document.getElementById('attendanceDate'), form=document.getElementById('attendanceFormBox'), note=document.getElementById('attendanceClosedNotice');
            if(!field||!field.value||!form||!note)return false;
            const key=field.value; const d=new Date(key+'T12:00:00'); if(Number.isNaN(d.getTime()))return false;
            const event=typeof officeEventForDate==='function'?officeEventForDate(d):null;
            const configured=String(v4CurrentWeekoff||document.getElementById('displayWeekoff')?.textContent||'Sunday').split(/[,;/]/).map(x=>x.trim().toLowerCase());
            const dayNames=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            const isWeekoff=configured.includes(dayNames[d.getDay()]);
            const rec=(globalMonthlyFullAttendance||[]).find(a=>String(a.Date||'')===key);
            const leaveText=String(rec?.Leave||'').trim().toLowerCase();
            const isLeave=!isWeekoff && !event && leaveText.includes('leave');
            const closedType=event ? 'Holiday' : (isLeave ? 'Leave' : (isWeekoff ? 'Weekoff' : ''));
            const reason=event ? ('Office Closed: '+String(event.name||'Holiday / Event')) : (isLeave ? 'Today Leave' : (isWeekoff ? 'Today Weekoff' : ''));
            note.textContent=reason; note.classList.toggle('hidden',!reason); form.classList.toggle('is-closed',!!reason);

            // Non-working days: freeze Attendance + Namaz + Lunch controls.
            const freezeIds=['attendanceAction','manualTime','namazTypeSelect','namazBreakStartTime','namazBreakEndTime','lunchBreakStartTime','lunchBreakEndTime'];
            freezeIds.forEach(id=>{const el=document.getElementById(id); if(el) el.disabled=!!reason;});
            const attendanceBtn=document.getElementById('attendanceBtn'); if(attendanceBtn){attendanceBtn.disabled=!!reason; attendanceBtn.style.opacity=reason?'0.5':'';}
            const logBtn=document.getElementById('logDailyWorkBtn'); if(logBtn){logBtn.disabled=!!reason; logBtn.style.opacity=reason?'0.5':''; logBtn.title=reason?'Office closed / non-working day':'';}

            const statusEl=document.getElementById('todayLocationStatus'), cityEl=document.getElementById('todayLocationCity');
            if(statusEl&&cityEl){
                if(reason){
                    statusEl.textContent='Office Close';
                    cityEl.textContent=closedType;
                    statusEl.classList.remove('text-[#e6fcf5]','text-[#f59e0b]'); statusEl.classList.add('text-[#f59e0b]');
                    cityEl.classList.remove('text-[#e6fcf5]'); cityEl.classList.add('text-[#f59e0b]');
                } else {
                    renderTodayLocation();
                }
            }
            return !!reason;
        }
        document.addEventListener('change',function(e){
            if(e.target&&e.target.id==='attendanceDate'){
                const selectedDate=e.target.value||localDateKey();
                const logDate=document.getElementById('logWorkDate');
                if(logDate){
                    logDate.value=selectedDate;
                    if(typeof updateLogWorkDateUI==='function') updateLogWorkDateUI();
                }
                updateAttendanceNonWorkingDay();
                renderSelectedAttendanceState();
                updateTodayUrgentTaskButtonState();
                updateLogDailyWorkButtonState();
            }
        });

        function getShiftStartMinsClient(){ const s=document.getElementById('displayOfficeTime')?.innerText||''; const parts=s.toLowerCase().split('to'); return parts.length>1?timeToMins(parts[0].trim()):-1; }
        function getShiftEndMinsClient(){ const s=document.getElementById('displayOfficeTime')?.innerText||''; const parts=s.toLowerCase().split('to'); return parts.length>1?timeToMins(parts[1].trim()):-1; }
        function updateAttendanceTimingReasonUI(){
            const action=document.getElementById('attendanceAction')?.value||'', date=document.getElementById('attendanceDate')?.value||'', manual=document.getElementById('manualTime')?.value||'';
            const wrap=document.getElementById('attendanceTimingReasonBox'), sel=document.getElementById('attendanceTimingReasonSelect'), ta=document.getElementById('attendanceTimingReason');
            if(!wrap||!sel||!ta)return; let needed=''; const mm=timeToMins(manual); const sm=getShiftStartMinsClient(), em=getShiftEndMinsClient();
            if(action==='Punch In' && mm>=0 && sm>=0 && mm>sm) needed='Delay Hone Hone Ka Reason';
            if(action==='Punch Out' && mm>=0 && em>=0 && mm<em) needed='Before Jaane Ka Reasion';
            if(needed){
                wrap.classList.remove('hidden');
                sel.innerHTML = `<option value="${needed}">${needed}</option>`;
                sel.value=needed; sel.disabled=false;
                ta.classList.remove('hidden'); ta.placeholder='Write your reason here...';
            } else { wrap.classList.add('hidden'); sel.innerHTML='<option value="">-- Select Reason --</option>'; sel.value=''; sel.disabled=false; ta.value=''; ta.classList.add('hidden'); }
        }

        function renderSelectedAttendanceState(){
            const box=document.getElementById('attendanceSavedStatus');
            if(!box)return;
            const date=document.getElementById('attendanceDate')?.value||'';
            const user=(document.getElementById('displayUser')?.innerText||'').trim().toLowerCase();
            if(!date||!user){box.textContent='Attendance: Not Saved';return;}
            let rec=(globalMonthlyFullAttendance||[]).find(a=>String(a.Date||'')===date && String(a.Employee||'').trim().toLowerCase()===user);
            if(!rec){box.textContent='Attendance: Not Saved';return;}
            const inT=rec.InTime||''; const outT=rec.OutTime||'';
            const parts=[];
            if(inT)parts.push('In: '+inT);
            if(outT)parts.push('Out: '+outT);
            box.textContent=parts.length?'Attendance Saved • '+parts.join(' | '):'Attendance: Not Saved';
        }
        function renderTodayLocation(){
            const statusEl=document.getElementById('todayLocationStatus'), cityEl=document.getElementById('todayLocationCity');
            if(!statusEl||!cityEl)return;
            const officeCity=(window.currentUserOfficeLocation||document.getElementById('displayOfficeLocation')?.innerText||'').split(':')[0].trim()||'--';
            const today=new Date(); const key=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
            const schedules=Array.isArray(globalAdvanceScheduleRequests)?globalAdvanceScheduleRequests:[];
            const outdoorTypes=['3 Days Qafila','Tarbiyati Ijtima','Journey','Meeting Journey'];
            const outdoorSchedule=schedules.find(r=>String(r.status||'').toLowerCase()==='approved' && outdoorTypes.includes(String(r.requestType||'').trim()) && key>=String(r.requestDate||'') && key<=String(r.endDate||r.requestDate||''));
            let outdoorTask=false;
            try{ outdoorTask=(globalAllTasks||[]).some(t=>{
                const active=key>=String(t.startDate||'')&&key<=String(t.endDate||'');
                const works=Array.isArray(t.works)?t.works:[];
                return active&&works.some(w=>String(w.category||'').trim().toLowerCase()==='outdoor');
            }); }catch(_e){}
            if(outdoorSchedule||outdoorTask){
                statusEl.textContent='Outdoor';
                cityEl.textContent=(outdoorSchedule&&String(outdoorSchedule.location||'').trim())||'Outdoor Location';
                statusEl.classList.remove('text-[#e6fcf5]'); statusEl.classList.add('text-[#f59e0b]');
            }else{
                statusEl.textContent='In Office';
                cityEl.textContent=officeCity;
                statusEl.classList.remove('text-[#f59e0b]'); statusEl.classList.add('text-[#e6fcf5]');
            }
        }
        function refreshDailyActionWidgets(){ renderSelectedAttendanceState(); renderTodayLocation(); if(typeof updateLogDailyWorkButtonState==='function')updateLogDailyWorkButtonState(); if(typeof updateTodayUrgentTaskButtonState==='function')updateTodayUrgentTaskButtonState(); }

        async function apiFetchJson_(url, options){
            const opts=options||{};
            const parseResponse=async(res)=>{
                const text=await res.text();
                const trimmed=String(text||'').trim();
                try{return JSON.parse(trimmed);}
                catch(_jsonErr){
                    const title=(trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
                    const body=(trimmed.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).slice(0,220);
                    throw new Error('Backend ne JSON ke bajaye HTML response diya. '+(title||body||('HTTP '+res.status)));
                }
            };
            let res=await fetch(url,opts);
            try{return await parseResponse(res);}
            catch(firstErr){
                // Google Apps Script deployments and some Cloudflare proxies can
                // return an HTML redirect/error page for POST. The backend also
                // supports action-based GET, so retry the same parameters via GET.
                if(opts.method==='POST' && opts.body instanceof FormData){
                    const params=new URLSearchParams();
                    opts.body.forEach((v,k)=>{ if(typeof v==='string')params.append(k,v); });
                    const sep=url.includes('?')?'&':'?';
                    const retry=await fetch(url+sep+params.toString(),{method:'GET',credentials:opts.credentials||'same-origin'});
                    return await parseResponse(retry);
                }
                throw firstErr;
            }
        }

        function markAttendance(){
            if(updateAttendanceNonWorkingDay())return;
            const selectedDate=document.getElementById('attendanceDate')?.value||'', action=document.getElementById('attendanceAction')?.value||'Punch In', manual=document.getElementById('manualTime')?.value||'';
            const btn=document.getElementById('attendanceBtn'); if(!selectedDate){alert('Select a date!');return;} const lockState=applyAttendanceLockUI(selectedDate); if(lockState.locked){alert('Is date par Admin ne Attendance/Breaks LOCK kiye hue hain. Pehle Admin se UNLOCK karwayein.');return;} v4UpdateAttendanceAvailability();if(btn.disabled)return;
            const inTime=action==='Punch In'?manual:'',outTime=action==='Punch Out'?manual:'';
            const namazType=getSelectedNamazType(),namazStart=document.getElementById('namazBreakStartTime')?.value||'',namazEnd=document.getElementById('namazBreakEndTime')?.value||'',lunchStart=document.getElementById('lunchBreakStartTime')?.value||'',lunchEnd=document.getElementById('lunchBreakEndTime')?.value||'';
            if(namazStart||namazEnd){if(!namazType){alert('Pehle Namaz select karein.');return;}}
            if(!inTime&&!outTime&&!namazStart&&!namazEnd&&!lunchStart&&!lunchEnd){alert('Attendance ya Break ka time enter karein.');return;}
            if((inTime||outTime)&&!manual){alert('Select Time manually!');return;}
            const timingReason=document.getElementById('attendanceTimingReason')?.value.trim()||'';
            const timingReasonType=document.getElementById('attendanceTimingReasonSelect')?.value||'';
            if(inTime)updateAttendanceTimingReasonUI(); if(outTime)updateAttendanceTimingReasonUI();
            const fd=new FormData();fd.append('action','saveDailyActions');fd.append('selectedDate',selectedDate);fd.append('inTime',inTime?formatTime12h(inTime):'');fd.append('outTime',outTime?formatTime12h(outTime):'');fd.append('inDelayReason',inTime?timingReason:'');fd.append('outBeforeReason',outTime?timingReason:'');fd.append('namazType',namazType);fd.append('namazStart',namazStart?formatTime12h(namazStart):'');fd.append('namazEnd',namazEnd?formatTime12h(namazEnd):'');fd.append('lunchStart',lunchStart?formatTime12h(lunchStart):'');fd.append('lunchEnd',lunchEnd?formatTime12h(lunchEnd):'');fd.append('extraBreakReason',document.getElementById('extraBreakReason')?.value.trim()||'');fd.append('sessionToken',sessionToken);
            // Client-side punch-out restriction for today's shift.
            if(action==='Punch Out'&&selectedDate===(()=>{const d=new Date(),tz=d.getTimezoneOffset()*60000;return new Date(d-tz).toISOString().split('T')[0]})()){const shift=document.getElementById('displayOfficeTime')?.innerText||'',parts=shift.toLowerCase().split('to');if(parts.length>1){const endM=timeToMins(parts[1].trim()),now=new Date(),cur=now.getHours()*60+now.getMinutes();if(endM>=0&&cur<endM){alert(`Closing time is ${parts[1].trim().toUpperCase()}. Punch Out is not allowed before closing time.`);return;}}}
            btn.innerText='Saving...';btn.disabled=true;
            apiFetchJson_(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(d=>{if(d.status==='error')throw new Error(d.message||'Daily Actions save failed.');alert(d.message||'Daily Actions saved.');['namazTypeSelect','namazBreakStartTime','namazBreakEndTime','lunchBreakStartTime','lunchBreakEndTime','manualTime','extraBreakReason'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});const _tr=document.getElementById('attendanceTimingReason');if(_tr)_tr.value='';document.getElementById('attendanceTimingReasonBox')?.classList.add('hidden');clearPendingBreakAction();refreshDailyActionWidgets();fetchDashboardDataSilently();}).catch(e=>alert(e.message||'Daily Actions save failed.')).finally(()=>{btn.innerText='Submit Record';btn.disabled=false;updateBreakTypeOptions();});
        }

        // ================= TODAY SHIFT TRACKER =================
        function calculateTimeTracker(att) {
            const breakEl = document.getElementById('todayBreakTime');
            const netEl = document.getElementById('todayNetWork');
            if (!breakEl || !netEl) return;

            const toMins = (v) => {
                if (v === null || v === undefined || v === '') return null;
                if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
                const n = Number(v);
                if (!isNaN(n) && n >= 0 && n <= 1440) return n;
                const m = String(v).trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                if (!m) return null;
                let h = Number(m[1]), min = Number(m[2]);
                const ap = (m[3] || '').toUpperCase();
                if (ap === 'PM' && h < 12) h += 12;
                if (ap === 'AM' && h === 12) h = 0;
                return h * 60 + min;
            };

            if (!att) {
                breakEl.innerText = '0 Min';
                netEl.innerText = '0h 0m';
                return;
            }

            const inM = toMins(att.inTime);
            let outM = toMins(att.outTime);
            let breakM = 0;
            const bs = toMins(att.breakStarts);
            const be = toMins(att.breakEnds);
            if (bs !== null && be !== null) breakM += Math.max(0, be - bs);

            // Support multiple break pairs stored as "time | time" values.
            const bsRaw = String(att.breakStarts || '');
            const beRaw = String(att.breakEnds || '');
            const bsParts = bsRaw.split('|').map(x => toMins(x)).filter(x => x !== null);
            const beParts = beRaw.split('|').map(x => toMins(x)).filter(x => x !== null);
            if (bsParts.length > 1 || beParts.length > 1) {
                breakM = 0;
                const count = Math.min(bsParts.length, beParts.length);
                for (let i = 0; i < count; i++) breakM += Math.max(0, beParts[i] - bsParts[i]);
            }

            breakEl.innerText = `${breakM} Min`;
            if (inM === null) {
                netEl.innerText = '0h 0m';
                return;
            }

            if (outM === null) {
                const now = new Date();
                outM = now.getHours() * 60 + now.getMinutes();
            }
            if (outM < inM) outM += 24 * 60;
            const extraBreak = Math.max(0, Number(att.extraBreakMinutes || att.ExtraBreakMinutes || 0));
            const net = Math.max(0, (outM - inM) - extraBreak);
            const h = Math.floor(net / 60);
            const m = net % 60;
            netEl.innerText = `${h}h ${m}m`;
            if(extraBreak>0) breakEl.innerText = `${breakM} Min (Extra ${extraBreak} Min)`, breakEl.title='Extra break duty mein count nahi hai.';
        }

        // ================= FETCH ALL DATA =================
        function fetchDashboardData(username, role, dept) {
            const hasCache = restoreDashboardCache(username);
            const tbody = document.getElementById('taskTableBody');
            if(!hasCache) tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-500 font-semibold animate-pulse">Loading workspace data...</td></tr>';
            fetchDataAPI(username, role, dept, !!hasCache, 0);
        }

        function fetchDashboardDataSilently() {
            const syncIcon = document.getElementById('syncIcon');
            if(syncIcon) syncIcon.classList.add('fa-spin');
            
            const username = document.getElementById('displayUser').innerText;
            const role = document.getElementById('displayRole').innerText;
            const dept = document.getElementById('displayDept').innerText;
            fetchDataAPI(username, role, dept, true, 0);
        }

        // Fast dashboard cache: show the last successful dashboard immediately, then sync in background.
        function dashboardCacheKey(username){ return 'office_task_dashboard_cache_v2_' + String(username||'').trim().toLowerCase(); }
        function restoreDashboardCache(username){
            try{
                const raw=localStorage.getItem(dashboardCacheKey(username));
                if(!raw) return false;
                const data=JSON.parse(raw);
                if(!data || data.status!=='success') return false;
                globalAllTasks=Array.isArray(data.tasks)?data.tasks:[];
                globalTeamMembers=Array.isArray(data.teamMembers)?data.teamMembers:[];
                globalTeamMemberMeta=Array.isArray(data.teamMemberMeta)?data.teamMemberMeta:[];
                globalMonthlyFullAttendance=Array.isArray(data.monthlyFullAttendance)?data.monthlyFullAttendance:[];
                globalWorkLogs=[]; window.globalDelayReports=[];
                globalTeamAttendance=Array.isArray(data.teamAttendance)?data.teamAttendance:[];
                globalAdvanceScheduleRequests=Array.isArray(data.advanceScheduleRequests)?data.advanceScheduleRequests:[];
                globalAttendanceRequests=Array.isArray(data.attendanceRequests)?data.attendanceRequests:[]; globalOfficeEvents=Array.isArray(data.officeEvents)?data.officeEvents:[];globalAttendanceDateLocks=Array.isArray(data.attendanceDateLocks)?data.attendanceDateLocks:[];updateAttendanceNonWorkingDay();updateAttendanceNonWorkingDay();v4UpdateAttendanceAvailability();updateTodayUrgentTaskButtonState(); window.serverNotifications=Array.isArray(data.serverNotifications)?data.serverNotifications:[]; window.serverDashboardSummary=Array.isArray(data.dashboardSummary)?data.dashboardSummary:[];
                attendanceEntryStart=data.todayAttendanceEntryStart||attendanceEntryStart;
                attendanceEntryEnd=data.todayAttendanceEntryEnd||attendanceEntryEnd;
                setDateConstraints();
                const roleNow=String(document.getElementById('displayRole')?.innerText||role||'').toLowerCase();
                if(roleNow.indexOf('hod')>-1 || roleNow.indexOf('admin')>-1){ populateTeamDropdowns(globalTeamMembers); renderTeamAttendance(globalTeamAttendance); }
                else { calculateTimeTracker(data.todayAttendance); populateLogTaskDropdown(globalAllTasks); }
                refreshDailyActionWidgets();
                filterTasksByEmp();
                return true;
            }catch(e){ return false; }
        }

        let workLogsLoadPromise = null;
        function ensureWorkLogsLoaded(force=false){
            if(!sessionToken) return Promise.resolve([]);
            if(!force && Array.isArray(globalWorkLogs) && globalWorkLogs.length) return Promise.resolve(globalWorkLogs);
            if(workLogsLoadPromise) return workLogsLoadPromise;
            const fd=new FormData(); fd.append('action','getWorkLogs'); fd.append('sessionToken',sessionToken);
            workLogsLoadPromise=fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{
                if(d.status!=='success') throw new Error(d.message||'Work logs load failed.');
                globalWorkLogs=Array.isArray(d.workLogs)?d.workLogs:[];
                return globalWorkLogs;
            }).finally(()=>{workLogsLoadPromise=null;});
            return workLogsLoadPromise;
        }

        function fetchDashboardSummaryFast(){
            if(!sessionToken)return;
            const fd=new FormData(); fd.append('action','getDashboardSummary'); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{if(d.status==='success'){window.serverDashboardSummary=Array.isArray(d.summary)?d.summary:[];}}).catch(()=>{});
        }

        // Dashboard sync: never leave the table stuck on "Loading".
        // Cached data is rendered first for instant display; Apps Script refreshes it in the background.
        function fetchDataAPI(username, role, dept, silent = false, retryCount = 0) {
            if(retryCount===0) restoreDashboardCache(username);
            if(dashboardSyncInProgress) return;
            if(!sessionToken) {
                dashboardSyncInProgress = false;
                if(!silent) {
                    document.getElementById('taskTableBody').innerHTML = '<tr><td colspan="7" class="py-8 text-center text-red-600 font-semibold">Session expired. Please logout and login again.</td></tr>';
                }
                return;
            }

            dashboardSyncInProgress = true;
            const formData = new FormData();
            formData.append('action', 'getDashboardData');
            formData.append('username', username);
            formData.append('role', role);
            formData.append('department', dept);
            formData.append('sessionToken', sessionToken);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData, signal: controller.signal, cache: 'no-store' })
            .then(res => {
                if(!res.ok) throw new Error('Server returned HTTP ' + res.status);
                return res.text();
            })
            .then(raw => {
                let data;
                try { data = JSON.parse(raw); }
                catch(e) { throw new Error('Invalid response from Google Apps Script. Please redeploy backend_code.js as a Web App.'); }

                if(data.status !== 'success') {
                    throw new Error(data.message || 'Dashboard data could not be loaded.');
                }

                globalAllTasks = Array.isArray(data.tasks) ? data.tasks : [];
                globalTeamMembers = Array.isArray(data.teamMembers) ? data.teamMembers : [];
                globalTeamMemberMeta = Array.isArray(data.teamMemberMeta) ? data.teamMemberMeta : [];
                globalMonthlyFullAttendance = Array.isArray(data.monthlyFullAttendance) ? data.monthlyFullAttendance : [];
                globalWorkLogs = []; window.globalDelayReports=[];
                attendanceEntryStart = data.todayAttendanceEntryStart || attendanceEntryStart;
                attendanceEntryEnd = data.todayAttendanceEntryEnd || attendanceEntryEnd;
                setDateConstraints();
                globalTeamAttendance = Array.isArray(data.teamAttendance) ? data.teamAttendance : [];
                globalAdvanceScheduleRequests = Array.isArray(data.advanceScheduleRequests) ? data.advanceScheduleRequests : [];
                globalAttendanceRequests = Array.isArray(data.attendanceRequests) ? data.attendanceRequests : []; globalOfficeEvents = Array.isArray(data.officeEvents) ? data.officeEvents : []; globalAttendanceDateLocks = Array.isArray(data.attendanceDateLocks) ? data.attendanceDateLocks : [];updateAttendanceNonWorkingDay();updateAttendanceNonWorkingDay();v4UpdateAttendanceAvailability();updateTodayUrgentTaskButtonState(); window.serverNotifications=Array.isArray(data.serverNotifications)?data.serverNotifications:[]; window.serverDashboardSummary=Array.isArray(data.dashboardSummary)?data.dashboardSummary:[];

                // Keep the latest successful result locally so the next page/login opens instantly.
                try {
                    const cachePayload = Object.assign({}, data, {status:'success', cachedAt:Date.now()});
                    localStorage.setItem(dashboardCacheKey(username), JSON.stringify(cachePayload));
                } catch(cacheErr) {}

                if (isManagerRole(role)) {
                    populateTeamDropdowns(globalTeamMembers);
                    renderTeamAttendance(globalTeamAttendance);
                } else {
                    calculateTimeTracker(data.todayAttendance);
                    populateLogTaskDropdown(globalAllTasks);
                }
                refreshDailyActionWidgets();

                filterTasksByEmp();
            })
            .catch(err => {
                console.error('Dashboard sync error:', err);
                if(retryCount < 1) {
                    setTimeout(() => fetchDataAPI(username, role, dept, silent, retryCount + 1), 800);
                    return;
                }

                if(!silent) {
                    const message = err && err.name === 'AbortError'
                        ? 'Dashboard loading timed out. Please check the Google Apps Script Web App deployment and try Sync again.'
                        : (err.message || 'Unable to load dashboard data.');
                    document.getElementById('taskTableBody').innerHTML = `<tr><td colspan="7" class="py-8 text-center text-red-600 font-semibold">${message}<br><button onclick="fetchDashboardDataSilently()" class="mt-3 bg-[#259b94] hover:bg-[#1f827c] text-white px-4 py-2 rounded-lg text-sm">Retry Sync</button></td></tr>`;
                }
            })
            .finally(() => {
                clearTimeout(timeoutId);
                dashboardSyncInProgress = false;
                const syncIcon = document.getElementById('syncIcon');
                if(syncIcon) syncIcon.classList.remove('fa-spin');
            });
        }

        function populateTeamDropdowns(members) {
            const assignSelect = document.getElementById('newTaskUser');
            const filterSelect = document.getElementById('hodEmpFilter');
            const emailEmpSelect = document.getElementById('emailEmpSelect');
            const whatsappEmpSelect = document.getElementById('whatsappEmpSelect');
            
            let currentFilter = filterSelect ? filterSelect.value : 'All';

            if(assignSelect) assignSelect.innerHTML = '';
            if(filterSelect) filterSelect.innerHTML = '<option value="All">All Employees</option>';
            if(emailEmpSelect) emailEmpSelect.innerHTML = '';
            if(whatsappEmpSelect) whatsappEmpSelect.innerHTML = '';
            
            members=(members||[]).filter(m=>{const v=(typeof m==='string'?m:(m&&m.username)||''); return !!v;});
            members.forEach(m => { const mv=(typeof m==='string'?m:(m.username||'')); const md=(typeof m==='string'?m:(m.displayName||m.username||''));
                if(assignSelect) assignSelect.innerHTML += `<option value="${escapeHtml(mv)}">${escapeHtml(md)}</option>`;
                if(filterSelect) filterSelect.innerHTML += `<option value="${m}">${m}</option>`;
                if(emailEmpSelect) emailEmpSelect.innerHTML += `<option value="${m}">${m}</option>`;
                if(whatsappEmpSelect) whatsappEmpSelect.innerHTML += `<option value="${m}">${m}</option>`;
            });

            if(filterSelect && members.includes(currentFilter)) filterSelect.value = currentFilter;
        }

        function localDateKey(d=new Date()){ const x=new Date(d); x.setHours(12,0,0,0); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
        function getDateLockRecordClient(dateKey,targetUser){
            const key=String(dateKey||'').trim(), month=key.slice(0,7), rows=Array.isArray(globalAttendanceDateLocks)?globalAttendanceDateLocks:[];
            const today=localDateKey();
            // Future dates can never be unlocked. A full-month unlock is a current-month
            // override only; it expires automatically when the month closes.
            if(!/^\d{4}-\d{2}-\d{2}$/.test(key) || key>today)return null;
            const currentMonth=today.slice(0,7);
            const user=String(targetUser||document.getElementById('displayUser')?.innerText||'').trim().toLowerCase();
            const candidates=rows.map((r,i)=>({r:r,i:i})).filter(x=>{
                const r=x.r, scope=String(r.scope||'').toLowerCase(), k=String(r.key||''), ru=String(r.targetUser||'').trim().toLowerCase();
                // Month unlock/lock is valid only for the currently active month.
                // A range/date rule remains limited to its explicitly selected date.
                const matchesKey=(scope==='date'&&k===key)||(scope==='month'&&k===month&&month===currentMonth);
                if(!matchesKey)return false;
                return !ru || (!!user && ru===user);
            });
            if(!candidates.length)return null;
            // Latest matching rule wins. Specific date/user rules therefore override
            // older month rules, and a later lock can restore the default restriction.
            candidates.sort((a,b)=>b.i-a.i);
            return candidates[0].r||null;
        }
        function isDateUnlockedClient(dateKey){const r=getDateLockRecordClient(dateKey);return !!r&&String(r.status).toUpperCase()==='UNLOCKED';}
        function isDateLockedClient(dateKey){const r=getDateLockRecordClient(dateKey);return !!r&&String(r.status).toUpperCase()==='LOCKED';}
        function applyAttendanceLockUI(dateKey){
            const key=String(dateKey||'').trim(), r=getDateLockRecordClient(key), locked=!!r&&String(r.status).toUpperCase()==='LOCKED';
            const unlocked=isDateUnlockedClient(key);
            const notice=document.getElementById('attendanceClosedNotice');
            if(locked&&notice){notice.textContent='Admin ne '+(String(r.scope).toLowerCase()==='month'?'is month':'is date')+' ko LOCK kiya hua hai. Attendance/Breaks ke liye Admin se UNLOCK karwayein.';notice.classList.remove('hidden');}
            return {locked,unlocked};
        }

        function parseLocalDateKey(v){ const p=String(v||'').split('-').map(Number); return p.length===3&&!p.some(Number.isNaN)?new Date(p[0],p[1]-1,p[2],12):null; }
        function isLogWorkNonWorkingDate(dateKey){
            const d=parseLocalDateKey(dateKey); if(!d)return 'Invalid date';
            const event=typeof officeEventForDate==='function'?officeEventForDate(d):null;
            if(event)return String(event.name||'Office Closed/Holiday');
            const names=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            const configured=String(window.currentUserWeekoff||v4CurrentWeekoff||'Sunday').split(/[,;/]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
            const key=String(dateKey);
            const movedToWeekoff=(globalAdvanceScheduleRequests||[]).some(r=>String(r.status||'').toLowerCase()==='approved'&&String(r.requestType||'')==='Weekoff Adjustment'&&String(r.employee||'').trim().toLowerCase()==String(document.getElementById('displayUser')?.innerText||'').trim().toLowerCase()&&String(r.requestDate||'')===key);
            if(movedToWeekoff)return 'Weekoff Adjustment';
            if(configured.includes(names[d.getDay()])){
                const hasAdjustment=(globalAdvanceScheduleRequests||[]).some(r=>String(r.status||'').toLowerCase()==='approved'&&String(r.requestType||'')==='Weekoff Adjustment'&&String(r.employee||'').trim().toLowerCase()==String(document.getElementById('displayUser')?.innerText||'').trim().toLowerCase());
                if(!hasAdjustment)return 'Weekoff';
            }
            const att=(globalMonthlyFullAttendance||[]).find(a=>String(a.Date||'')===String(dateKey).split('-').reverse().join('-')||String(a.Date||'')===String(dateKey));
            if(att && String(att.Leave||'').toLowerCase().includes('leave'))return 'Leave';
            return '';
        }
        function isLogWorkDateAllowed(dateKey){
            // Temporary baseline: Daily Work is available from 01-Oct-2026 through today.
            // Future dates are blocked and Admin Lock/Unlock remains authoritative.
            const d=parseLocalDateKey(dateKey), today=parseLocalDateKey(localDateKey()); if(!d||!today)return false;
            if(d>today || String(dateKey)<ENTRY_BASELINE_DATE)return false;
            if(isDateLockedClient(dateKey))return false;
            return true;
        }
        function setLogWorkDateConstraints(){
            const el=document.getElementById('logWorkDate'); if(!el)return;
            const today=localDateKey();
            el.min=ENTRY_BASELINE_DATE;
            el.max=today;
            // Do not jump back to today just because a previous date is
            // temporarily locked or is being refreshed. Keep the selected
            // date; the save/open validation decides whether it is writable.
            if(!el.value||String(el.value)<ENTRY_BASELINE_DATE||String(el.value)>today)el.value=today;
        }
        function getAttendanceForLogDate(workDate){
            const key=String(workDate||'').trim();
            const records=Array.isArray(globalMonthlyFullAttendance)?globalMonthlyFullAttendance:[];
            return records.find(a=>{
                const d=String(a.Date||a.date||a.WorkDate||'').trim();
                return d===key || d===key.split('-').reverse().join('-');
            })||null;
        }
        function hasPunchInForLogDate(workDate){
            const rec=getAttendanceForLogDate(workDate);
            return !!rec && String(rec.InTime||rec.inTime||'').trim()!=='';
        }
        function updateLogTaskTemplateMeta(){
            const sel=document.getElementById('logTaskSelect'); if(!sel)return;
            let box=document.getElementById('logTaskTemplateMeta');
            if(!box){
                box=document.createElement('div'); box.id='logTaskTemplateMeta';
                box.className='mt-2 p-2 rounded-lg bg-[#f0f7f7] border border-[#b9dddd] text-xs text-[#2a4d53]';
                sel.parentElement?.appendChild(box);
            }
            const task=(globalAllTasks||[]).find(t=>String(t.rowIndex)===String(sel.value));
            if(!task){box.classList.add('hidden');box.innerHTML='';updateLogTaskTimeSpentMeta_(null);return;}
            const freq=String(task.frequency||'One-time');
            const taskType=getTaskType_(task)||'-';
            box.innerHTML=`<div class="flex flex-wrap gap-4"><span><b>Task Frequency:</b> ${escapeHtml(freq)}</span><span><b>Task Type:</b> ${escapeHtml(taskType)}</span></div>`;
            box.classList.remove('hidden');
            updateLogTaskTimeSpentMeta_(task);
        }

        function removeLegacyLogTaskMetaSelectors_(){
            ['logTaskTypeWrap','logTaskCategoryWrap','logTaskTypeSelect','logTaskCategorySelect'].forEach(id=>{
                const el=document.getElementById(id); if(el) el.remove();
            });
        }
        function ensureLogTaskTypeSelector_(){ removeLegacyLogTaskMetaSelectors_(); return null; }
        function ensureLogWorkCategorySelector_(){ removeLegacyLogTaskMetaSelectors_(); return null; }

        function findSourceTemplateForTask_(task){
            if(!task)return null;
            const tid=String(task.templateId||task.TemplateId||task.taskTemplateId||task.templateID||'').trim();
            const name=String(task.taskName||task.TaskName||task.name||'').trim().toLowerCase();
            const pools=[
                ...(Array.isArray(assignTemplateCache)?assignTemplateCache:[]),
                ...(Array.isArray(quickTemplateDataCache?.templates)?quickTemplateDataCache.templates:[])
            ];
            return pools.find(t=>tid && String(t.templateId||t.TemplateId||'').trim()===tid) ||
                   pools.find(t=>name && String(t.taskName||t.TaskName||t.name||'').trim().toLowerCase()===name) ||
                   null;
        }

        function getTaskType_(task){
            const direct=[task?.taskType,task?.TaskType,task?.templateTaskType,task?.type]
                .map(v=>String(v||'').trim()).find(Boolean);
            if(direct)return direct;
            const tpl=findSourceTemplateForTask_(task);
            return String(tpl?.taskType||tpl?.TaskType||tpl?.templateTaskType||tpl?.type||'').trim();
        }

        function getTaskCategories_(task){
            // Category must follow the selected task/template rule.
            const direct=[task?.category,task?.Category,task?.taskCategory,task?.TaskCategory]
                .map(v=>String(v||'').trim()).filter(Boolean);
            const tpl=findSourceTemplateForTask_(task);
            const templateCats=[tpl?.category,tpl?.Category,tpl?.taskCategory,tpl?.TaskCategory]
                .map(v=>String(v||'').trim()).filter(Boolean);

            // Prefer the template rule. Fall back to assigned-task data for older records.
            const all=templateCats.length ? templateCats : direct;
            return [...new Set(all)];
        }

        function setLogTaskMetaFromSelectedTask_(){
            removeLegacyLogTaskMetaSelectors_();
            updateLogTaskTemplateMeta();
            updateCompletionCheckboxState();
        }

        function populateLogWorkCategories_(tasks){
            setLogTaskMetaFromSelectedTask_();
        }

        function getTaskTotalMinutes_(task){
            if(!task)return 0;
            const stableId=String(task.taskId||task.TaskID||'').trim();
            const row=String(task.rowIndex||'').trim();
            const name=String(task.taskName||task.TaskName||'').trim().toLowerCase();
            let total=0;
            (globalWorkLogs||[]).forEach(w=>{
                const wid=String(w.TaskID||w.taskId||'').trim();
                const wrow=String(w.TaskRowIndex||w.taskRowIndex||'').trim();
                const wname=String(w.Task||w.TaskName||w.taskName||'').trim().toLowerCase();
                const match=(stableId&&wid===stableId)||(row&&wrow===row)||(!stableId&&!row&&name&&wname===name);
                if(match) total+=Number(w.TimeSpentMins||w.timeSpentMins||w.TimeSpent||w.timeSpent||0)||0;
            });
            return total>0 ? total : (Number(task.timeSpent)||0);
        }
        function updateLogTaskTimeSpentMeta_(task){
            const input=document.getElementById('logTimeMins'); if(!input)return;
            let box=document.getElementById('logTaskTimeSpentMeta');
            if(!box){
                box=document.createElement('div'); box.id='logTaskTimeSpentMeta';
                box.className='mt-1 text-xs font-semibold text-[#2a4d53]';
                input.parentElement?.appendChild(box);
            }
            box.textContent=`Current Time Spent: ${getTaskTotalMinutes_(task)} mins`;
        }
        function syncAllTaskTimeSpentFromLogs_(){
            if(!Array.isArray(globalWorkLogs)||!globalWorkLogs.length)return;
            (globalAllTasks||[]).forEach(t=>{ t.timeSpent=getTaskTotalMinutes_(t); });
        }

        function populateLogTaskDropdown(tasks, dateKey, categoryFilter){
            const select=document.getElementById('logTaskSelect'); if(!select)return;
            const workDate=dateKey||document.getElementById('logWorkDate')?.value||localDateKey();
            select.innerHTML='<option value="">-- Select Active Task --</option>';
            const loggedForDate=new Set((globalWorkLogs||[]).filter(w=>{
                const d=String(w.WorkDate||w.workDate||'');
                const st=String(w.ApprovalStatus||w.approvalStatus||'Approved').toLowerCase();
                return d===workDate && st!=='rejected';
            }).map(w=>String(w.TaskRowIndex||w.taskRowIndex||'')));
            const d=parseLocalDateKey(workDate);
            (tasks||[]).forEach(t=>{
                const st=String(t.empStatus||'').toLowerCase();
                const sd=parseReportDate(t.startDate), ed=parseReportDate(t.endDate);
                const active=!!d&&(!sd||d>=sd)&&(!ed||d<=ed);
                if(st!=='completed'&&active&&!loggedForDate.has(String(t.rowIndex))){
                    select.innerHTML+=`<option value="${t.rowIndex}">${escapeHtml(t.taskName||'Task')}</option>`;
                }
            });
            if(select.options.length===1)select.innerHTML='<option value="">-- No task available for selected date --</option>';
            setLogTaskMetaFromSelectedTask_();
            updateCompletionCheckboxState(); updateLogTaskTemplateMeta();
        }

        function filterTasksByEmp() {
            const role = document.getElementById('displayRole').innerText;
            const isHOD = (isManagerRole(role));
            let tasksToRender = globalAllTasks;

            if(isHOD) {
                const selectedEmp = document.getElementById('hodEmpFilter').value;
                if(selectedEmp !== 'All') {
                    tasksToRender = globalAllTasks.filter(t => t.assignedTo.trim().toLowerCase() === selectedEmp.trim().toLowerCase());
                }
            }
            renderTasks(tasksToRender, role);
            calculateReportCard(tasksToRender);
        }

        function getDeadlineHTML(endDateStr, empStatus, completedAt) {
            if (!endDateStr || endDateStr === '-') return `<span class="text-gray-500">-</span>`;

            const endParts = endDateStr.split('-');
            if (endParts.length !== 3) return `<span class="text-gray-500">${endDateStr}</span>`;

            const endD = new Date(Number(endParts[2]), Number(endParts[1]) - 1, Number(endParts[0]));
            endD.setHours(0,0,0,0);

            if (empStatus.toLowerCase() === 'completed') {
                if (!completedAt || completedAt === '-') {
                    return `<span class="text-green-600 font-bold px-2 py-1 rounded-md bg-green-50 text-xs"><i class="fas fa-check"></i> Done</span>`;
                }
                const cParts = completedAt.split('-');
                if (cParts.length !== 3) return `<span class="text-green-600 font-bold px-2 py-1 rounded-md bg-green-50 text-xs">Done</span>`;
                const completionD = new Date(Number(cParts[2]), Number(cParts[1]) - 1, Number(cParts[0]));
                completionD.setHours(0,0,0,0);

                // Positive = completed before due date, 0 = on time, negative = delayed.
                const completionVsDue = Math.round((endD - completionD) / (1000 * 60 * 60 * 24));
                if (completionVsDue < 0) {
                    return `<span class="text-red-600 font-bold px-2 py-1 rounded-md bg-red-50 text-xs">${completionVsDue} Days (Delayed)</span>`;
                }
                if (completionVsDue === 0) {
                    return `<span class="text-green-600 font-bold px-2 py-1 rounded-md bg-green-50 text-xs">0 Days (On Time)</span>`;
                }
                return `<span class="text-green-600 font-bold px-2 py-1 rounded-md bg-green-50 text-xs">+${completionVsDue} Days (Early)</span>`;
            }

            const today = new Date();
            today.setHours(0,0,0,0);
            const diffDays = Math.round((endD - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
                return `<span class="text-red-600 font-bold px-2 py-1 rounded-md bg-red-50 text-xs">${diffDays} Days (Delayed)</span>`;
            } else if (diffDays === 0) {
                return `<span class="text-green-600 font-bold px-2 py-1 rounded-md bg-green-50 text-xs">0 Days (On Time)</span>`;
            } else {
                return `<span class="text-green-600 font-bold px-2 py-1 rounded-md bg-green-50 text-xs">+${diffDays} Days Left</span>`;
            }
        }

        function buildTaskHodStatusHTML(task, isHOD, isAdmin) {
            const status = String(task.hodStatus || 'Pending');
            const empStatus = String(task.empStatus || '').toLowerCase();
            const completionRequested = empStatus === 'completion requested';
            if (String(status).toLowerCase() === 'approved') {
                return '<span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Approved</span>';
            }
            if (!isHOD && !isAdmin) {
                const cls = String(status).toLowerCase() === 'rejected'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600';
                return `<span class="px-3 py-1 rounded-full text-xs font-bold shadow-sm ${cls}">${escapeHtml(completionRequested ? 'Pending' : (status || 'Pending'))}</span>`;
            }
            if (!completionRequested) {
                const label = String(status).toLowerCase() === 'rejected' ? 'Rejected' : 'Pending';
                const cls = label === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
                return `<span class="px-3 py-1 rounded-full text-xs font-bold shadow-sm ${cls}">${label}</span>`;
            }
            return `<select onchange="updateTaskDB(${Number(task.rowIndex)}, 'hod', this.value, ${JSON.stringify(task.assignedTo)})" class="border border-[#7db0b1] rounded-md px-2 py-1 bg-white text-xs font-semibold text-[#2a4d53] cursor-pointer focus:ring-1 focus:ring-[#259b94]">
                <option value="Pending" ${String(status).toLowerCase()==='pending' ? 'selected' : ''}>Pending</option>
                <option value="Approved">Approve</option>
                <option value="Rejected">Reject</option>
            </select>`;
        }

        function renderTasks(tasksToRender, role) {
            window.__taskActionCache = {};
            const tbody = document.getElementById('taskTableBody'); 
            tbody.innerHTML = ''; 
            const isHOD = (isManagerRole(role));
            const isAdmin = isFullAdminRole(role);

            let compCount = 0, pendCount = 0;
            let dailyTotal = 0, dailyDone = 0;

            tasksToRender.forEach(t => {
                let eStat = t.empStatus.toLowerCase();
                if(eStat === 'completed') compCount++; else pendCount++;
                if(t.frequency.toLowerCase() === 'daily') {
                    dailyTotal++;
                    if(eStat === 'completed') dailyDone++;
                }
            });

            document.getElementById('statTotal').innerText = tasksToRender.length;
            document.getElementById('statCompleted').innerText = compCount;
            document.getElementById('statPending').innerText = pendCount;
            document.getElementById('statDaily').innerText = `${dailyDone} / ${dailyTotal}`;
            
            if(tasksToRender.length > 0) {
                let eff = Math.round((compCount / tasksToRender.length) * 100);
                const metricEfficiencyEl = document.getElementById('metricEfficiency');
                if (metricEfficiencyEl) metricEfficiencyEl.innerText = `${eff}%`;
            }

            if (tasksToRender.length === 0) {
                tbody.innerHTML = `<tr><td colspan="${isHOD?(isAdmin?12:12):11}" class="py-8 text-center text-gray-500 italic">No tasks found.</td></tr>`;
            } else {
                tasksToRender.forEach(task => {
                    const taskActionKey = Object.keys(window.__taskActionCache).length;
                    window.__taskActionCache[taskActionKey] = task;
                    let prioColor = task.priority.toLowerCase() === 'high' ? 'text-red-600' : 'text-yellow-600';
                    let tr = document.createElement('tr');
                    
                    let rowClass = "transition hover:bg-gray-50 border-b";
                    if (isHOD && task.empStatus.toLowerCase() === 'completed' && task.hodStatus.toLowerCase() === 'pending') {
                        rowClass += " bg-[#e6fcf5]"; 
                    }
                    tr.className = rowClass;

                    let empStatusHTML = '';
                    let hodStatusHTML = '';
                    const renderedTaskMinutes = getTaskTotalMinutes_(task);
                    let timeSpentHTML = `<span class="font-bold text-[#2a4d53]">${renderedTaskMinutes} mins</span>`;
                    let deadlineHTML = getDeadlineHTML(task.endDate, task.empStatus, task.completedAt);

                    let empLocked = (task.empStatus.toLowerCase() === 'completed' && !isAdmin) ? 'disabled' : '';
                    let hodLocked = (task.hodStatus.toLowerCase() === 'approved' && !isAdmin) ? 'disabled' : '';

                    if (!isHOD && !isAdmin) {
                        const eBadge = task.empStatus === 'Completed'
                            ? 'text-green-600 font-bold bg-green-50 px-2 py-1 rounded'
                            : 'text-yellow-600 font-semibold bg-yellow-50 px-2 py-1 rounded';
                        const employeeStatusLabel = String(task.empStatus||'').toLowerCase()==='completion requested'
                            ? (String(task.completionType||'').toLowerCase()==='before' ? 'Before Completion • Pending Approval' : 'Closing • Pending Approval')
                            : (task.empStatus === 'Completed' && String(task.completionType||'').toLowerCase()==='before' ? 'Before • Completed & Locked' : (task.empStatus === 'Completed' ? 'Completed & Locked' : 'Pending — complete via Log Daily Work'));
                        empStatusHTML = `<span class="${eBadge}">${employeeStatusLabel}</span>`;
                        let hBadge = task.hodStatus === 'Approved' ? 'bg-green-100 text-green-700' : (task.hodStatus === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600');
                        hodStatusHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold shadow-sm ${hBadge}">${task.hodStatus}</span>`;
                    } 
                    else if (isHOD && !isAdmin) { 
                        let eBadge = task.empStatus === 'Completed' ? 'text-green-600 font-bold bg-green-50 px-2 py-1 rounded' : 'text-yellow-600 font-semibold bg-yellow-50 px-2 py-1 rounded';
                        const managerStatusLabel = String(task.empStatus||'').toLowerCase()==='completion requested'
                            ? (String(task.completionType||'').toLowerCase()==='before' ? 'Before Completion • Pending Approval' : 'Closing • Pending Approval')
                            : (task.empStatus === 'Completed' && String(task.completionType||'').toLowerCase()==='before' ? 'Before • Completed' : task.empStatus);
                        empStatusHTML = `<span class="${eBadge}">${managerStatusLabel}</span>`;
                        hodStatusHTML = buildTaskHodStatusHTML(task, isHOD, isAdmin);
                    } 
                    else if (isAdmin) { 
                        empStatusHTML = `
                            <select onchange="updateTaskDB(${task.rowIndex}, 'emp', this.value, ${JSON.stringify(task.assignedTo)})" class="border border-[#7db0b1] rounded-md px-2 py-1 bg-white text-xs font-semibold text-[#2a4d53] cursor-pointer focus:ring-1 focus:ring-[#259b94]">
                                <option value="Pending" ${task.empStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="Completed" ${task.empStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                                <option value="Incomplete" ${task.empStatus === 'Incomplete' ? 'selected' : ''}>Incomplete</option>
                            </select>`;
                        hodStatusHTML = buildTaskHodStatusHTML(task, isHOD, isAdmin);
                    }

                    const replacementForToday = getApprovedTaskReplacement(task, new Date());
                    const displayTaskName = replacementForToday || task.taskName;
                    // Replace option removed from Assigned Tasks UI as requested.
                    const taskReplaceHTML = '';
                    const displayTaskType = task.taskType || task.templateTaskType || task.type || '-';
                    tr.innerHTML = `
                        <td class="py-4 px-6 font-bold text-[#112a2e]">${escapeHtml(displayTaskType)}</td>
                        <td class="py-4 px-6 font-bold text-[#112a2e]">${escapeHtml(displayTaskName)}${replacementForToday ? '<div class="text-[10px] text-[#0f766e] font-semibold mt-1">Replacement approved</div>' : ''}</td>
                         <td class="py-4 px-6 font-bold text-[#0f766e]">${escapeHtml(task.frequency||'One-time')}</td>
                         <td class="py-4 px-6 text-[#259b94] font-bold ${isHOD ? '' : 'hidden'}">${isHOD ? escapeHtml(task.assignedTo || '-') : ''}</td>
                         <td class="py-4 px-6 text-[#4b6d70] font-semibold">${escapeHtml(task.assignedBy || '-')}</td>
                         <td class="py-4 px-6 font-bold text-[#2a4d53]">${isHOD ? `<input type="number" min="0" max="85" value="${Number(task.weightage)||0}" onchange="updateTaskWeightage(${task.rowIndex}, this.value, ${JSON.stringify(task.assignedTo)})" class="w-20 border border-[#b2d8d8] rounded-md px-2 py-1 text-sm font-bold" title="Task weightage (%)">` : `${Number(task.weightage)||0}%`}</td>
                         <td class="py-4 px-6 text-xs text-[#4b6d70] font-semibold leading-tight"><i class="far fa-calendar text-[#7db0b1]"></i> ${task.startDate} <br><span class="text-[#7db0b1]">to</span><br> <i class="far fa-calendar-check text-[#7db0b1]"></i> ${task.endDate}</td>
                        <td class="py-4 px-6">${deadlineHTML}</td>
                        <td class="py-4 px-6 font-bold ${prioColor}">${task.priority} <br><span class="text-xs text-gray-400 font-medium">${task.frequency}</span></td>
                        <td class="py-4 px-6">${timeSpentHTML}</td>
                        <td class="py-4 px-6">${empStatusHTML}</td>
                        <td class="py-4 px-6">${hodStatusHTML}</td>
                        ${(isHOD || isAdmin || (!isHOD && !isAdmin)) ? `<td class="py-4 px-3 whitespace-nowrap">${isAdmin ? `<button type="button" onclick="openEditTaskModalByKey(${taskActionKey})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1.5 rounded-lg text-xs font-bold mr-1" title="Edit Task"><i class="fas fa-pen-to-square"></i> Edit</button><button type="button" onclick="deleteAssignedTaskByKey(${taskActionKey})" class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1.5 rounded-lg text-xs font-bold" title="Delete Task"><i class="fas fa-trash"></i> Delete</button>` : ''}${taskReplaceHTML}</td>` : ''}
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        function getApprovedTaskReplacement(task, dateObj){
            const ymd = dateObj instanceof Date ? dateObj.toISOString().slice(0,10) : String(dateObj||'').slice(0,10);
            const list = Array.isArray(task?.replaceRequests) ? task.replaceRequests : [];
            const hit = list.slice().reverse().find(r => String(r.status||'').toLowerCase()==='approved' && String(r.date||'').slice(0,10)===ymd && String(r.replacementTask||'').trim());
            return hit ? String(hit.replacementTask).trim() : '';
        }
        function openEditTaskModalByKey(key){ const task=window.__taskActionCache?.[key]; if(task) openEditTaskModal(task); }
        function deleteAssignedTaskByKey(key){ const task=window.__taskActionCache?.[key]; if(task) deleteAssignedTask(task.assignedTo,task.taskId,task.taskName,task.rowIndex); }
        function openTaskReplaceModal(task){
            const today=new Date().toISOString().slice(0,10);
            document.getElementById('replaceTaskId').value=task.taskId||'';
            document.getElementById('replaceTaskRow').value=task.rowIndex||'';
            document.getElementById('replaceTaskUser').value=task.assignedTo||'';
            const d=document.getElementById('replaceTaskDate'); d.value=today; d.min=task.startDate && /^\d{4}-\d{2}-\d{2}$/.test(task.startDate)?task.startDate:today; d.max=task.endDate && /^\d{4}-\d{2}-\d{2}$/.test(task.endDate)?task.endDate:'';
            document.getElementById('replaceTaskName').value='';
            document.getElementById('taskReplaceModal').style.display='block';
        }
        function closeTaskReplaceModal(){ const m=document.getElementById('taskReplaceModal'); if(m)m.style.display='none'; }
        function submitTaskReplaceRequest(){
            const taskId=document.getElementById('replaceTaskId').value, rowIndex=document.getElementById('replaceTaskRow').value, targetUser=document.getElementById('replaceTaskUser').value, date=document.getElementById('replaceTaskDate').value, replacementTask=document.getElementById('replaceTaskName').value.trim();
            if(!taskId||!targetUser||!date||!replacementTask){alert('Task date aur new task required hain.');return;}
            const btn=document.getElementById('replaceTaskSubmitBtn'); btn.disabled=true; btn.innerText='Sending...';
            const fd=new FormData(); fd.append('action','requestTaskReplace'); fd.append('taskId',taskId); fd.append('rowIndex',rowIndex||''); fd.append('targetUser',targetUser); fd.append('requestDate',date); fd.append('replacementTask',replacementTask); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{alert(d.message||'Request submitted.');if(d.status==='success'){closeTaskReplaceModal();fetchDashboardDataSilently();}}).catch(()=>alert('Task replace request failed.')).finally(()=>{btn.disabled=false;btn.innerText='Raise Request';});
        }
        function reviewTaskReplace(taskId,rowIndex,targetUser,decision,requestIndex){
            const fd=new FormData(); fd.append('action','reviewTaskReplace'); fd.append('taskId',taskId); fd.append('rowIndex',rowIndex||''); fd.append('targetUser',targetUser); fd.append('decision',decision); fd.append('requestIndex',requestIndex); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{alert(d.message||'Updated');if(d.status==='success')fetchDashboardDataSilently();}).catch(()=>alert('Task replace approval failed.'));
        }

        function openEditTaskModal(task){
            const role=String(document.getElementById('displayRole').innerText||'');
            if(!isFullAdminRole(role)){ alert('Task edit ka access sirf Admin ko hai.'); return; }
            document.getElementById('editTaskId').value=task.taskId||'';
            document.getElementById('editTaskOldUser').value=task.assignedTo||'';
            document.getElementById('editTaskOldRow').value=task.rowIndex||'';
            document.getElementById('editTaskName').value=task.taskName||'';
            document.getElementById('editTaskStart').value=toInputDate(task.startDate);
            document.getElementById('editTaskEnd').value=toInputDate(task.endDate);
            document.getElementById('editTaskWeight').value=Number(task.weightage)||0;
            document.getElementById('editTaskPriority').value=task.priority||'Normal';
            document.getElementById('editTaskFreq').value=task.frequency||'One-time';
            const desc=document.getElementById('editTaskDescription'); if(desc)desc.value=task.description||'';
            const sel=document.getElementById('editTaskUser'); sel.innerHTML='';
            const employees=assignEmployeeCache||[];
            if(employees.length){ employees.forEach(e=>{ const u=e.username||''; sel.innerHTML+=`<option value="${escapeHtml(u)}">${escapeHtml(e.displayName||u)} — ${escapeHtml(e.employeeId||'—')} • ${escapeHtml(e.department||'Department not set')}</option>`; }); }
            else sel.innerHTML=`<option value="${escapeHtml(task.assignedTo||'')}">${escapeHtml(task.assignedTo||'')}</option>`;
            sel.value=task.assignedTo||'';
            const box=document.getElementById('editTaskWorksBuilder'); box.innerHTML=''; (task.works||[]).forEach(w=>addEditTaskWorkRow(w)); if(!(task.works||[]).length)addEditTaskWorkRow();
            document.getElementById('editTaskModal').style.display='block';
        }
        function toInputDate(v){ const s=String(v||''); if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s; const p=s.split('-'); if(p.length===3 && /^\d{1,2}$/.test(p[0])) return `${p[2]}-${String(p[1]).padStart(2,'0')}-${String(p[0]).padStart(2,'0')}`; return ''; }
        function addEditTaskWorkRow(data={}){ const box=document.getElementById('editTaskWorksBuilder'); const row=document.createElement('div'); row.className='grid grid-cols-12 gap-2 items-center'; row.innerHTML=`<input class="col-span-4 border border-gray-300 p-2 rounded-md text-xs edit-task-work-category" placeholder="Category" value="${escapeHtml(data.category||'')}"><input class="col-span-5 border border-gray-300 p-2 rounded-md text-xs edit-task-work-name" placeholder="Work" value="${escapeHtml(data.work||'')}"><input type="number" min="0" max="100" class="col-span-2 border border-gray-300 p-2 rounded-md text-xs edit-task-work-weight" placeholder="Weight %" value="${Number(data.weightage)||0}"><button type="button" onclick="this.parentElement.remove()" class="col-span-1 bg-red-50 text-red-600 border border-red-200 rounded-md py-2 text-xs font-bold">×</button>`; box.appendChild(row); }
        function collectEditTaskWorks(){ return [...document.querySelectorAll('#editTaskWorksBuilder > div')].map(r=>({category:r.querySelector('.edit-task-work-category').value.trim(),work:r.querySelector('.edit-task-work-name').value.trim(),weightage:Number(r.querySelector('.edit-task-work-weight').value)||0})).filter(x=>x.category&&x.work); }
        function closeEditTaskModal(){ const m=document.getElementById('editTaskModal'); if(m)m.style.display='none'; }
        function saveEditedTask(){
            const taskId=document.getElementById('editTaskId').value, oldUser=document.getElementById('editTaskOldUser').value, newUser=document.getElementById('editTaskUser').value, name=document.getElementById('editTaskName').value.trim(), sd=document.getElementById('editTaskStart').value, ed=document.getElementById('editTaskEnd').value, wt=Number(document.getElementById('editTaskWeight').value)||0;
            if(!taskId||!oldUser||!newUser||!name||!sd||!ed){alert('Task, Employee, Name aur dates required hain.');return;} if(ed<sd){alert('Due Date Start Date se pehle nahi ho sakti.');return;} if(wt<0||wt>85){alert('Weightage 0 se 85% ke beech honi chahiye.');return;}
            const btn=document.getElementById('editTaskSaveBtn');btn.disabled=true;btn.innerText='Saving...';
            const fd=new FormData(); fd.append('action','updateTask');fd.append('taskId',taskId);fd.append('oldUser',oldUser);fd.append('newUser',newUser);fd.append('oldRow',document.getElementById('editTaskOldRow').value||'');fd.append('taskName',name);fd.append('startDate',sd);fd.append('endDate',ed);fd.append('weightage',wt);fd.append('priority',document.getElementById('editTaskPriority').value);fd.append('frequency',document.getElementById('editTaskFreq').value);fd.append('description',document.getElementById('editTaskDescription').value.trim());fd.append('worksJson',JSON.stringify(collectEditTaskWorks()));fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(async r=>{const text=await r.text();let d;try{d=JSON.parse(text);}catch(_){throw new Error('Backend response valid nahi hai. Google Apps Script Web App deployment check karein.');}if(d.status!=='success')throw new Error(d.message||'Task update failed');alert(d.message||'Task update ho gaya.');closeEditTaskModal();await fetchDashboardDataSilently();}).catch(e=>alert(e.message||'Task update nahi ho saka.')).finally(()=>{btn.disabled=false;btn.innerText='Save Task Changes';});
        }
        function clearAllTestingTasks(){
            const role=String(document.getElementById('displayRole').innerText||'');
            const currentUser=String(document.getElementById('displayUser')?.innerText||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
            if(!isFullAdminRole(role) || (currentUser!=='masteradmin' && currentUser!=='superadmin')){
                alert('Testing tasks ka bulk cleanup sirf MasterAdmin/SuperAdmin se kiya ja sakta hai.'); return;
            }
            const ok=confirm('WARNING: Testing ke SAARE assigned tasks delete honge.\n\nUsers, Attendance, WorkLogs, Departments aur Task Templates delete nahi honge.\n\nKya aap continue karna chahte hain?');
            if(!ok)return;
            const btn=document.querySelector('button[onclick="clearAllTestingTasks()"]'); if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i> Clearing...';}
            const fd=new FormData(); fd.append('action','clearAllTestingTasks'); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{
                if(d.status!=='success')throw new Error(d.message||'Cleanup failed');
                alert(d.message||'Testing tasks clear ho gaye.');
                fetchDashboardDataSilently();
            }).catch(e=>alert(e.message||'Testing tasks clear nahi ho sake.')).finally(()=>{
                if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-broom mr-1"></i> Clear Testing Tasks';}
            });
        }

        function deleteAssignedTask(targetUser, taskId, taskName, rowIndex){
            const role=String(document.getElementById('displayRole').innerText||'');
            if(!isFullAdminRole(role)) return;
            if(!confirm(`Kya aap ye task delete karna chahte hain?\n\nEmployee: ${targetUser}\nTask: ${taskName}`)) return;
            const fd=new FormData(); fd.append('action','deleteTask'); fd.append('targetUser',targetUser); fd.append('taskId',taskId); fd.append('rowIndex',rowIndex||''); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(async r=>{const text=await r.text();let data;try{data=JSON.parse(text);}catch(_){throw new Error('Backend response valid nahi hai. Google Apps Script Web App deployment check karein.');}
                if(data.status==='success'){ alert(data.message||'Task delete kar diya gaya hai.'); await fetchDashboardDataSilently(); }
                else alert(data.message||'Task delete nahi ho saka.');
            }).catch(e=>alert(e.message||'Task delete ke waqt connection error hua.'));
        }

        function renderTeamAttendance(teamData) {
            const tbody = document.getElementById('teamAttendanceBody');
            tbody.innerHTML = '';
            
            const role = document.getElementById('displayRole').innerText;
            const isHOD = (isManagerRole(role));
            const isAdmin = isFullAdminRole(role);

            if(!teamData || teamData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-gray-500 italic">No attendance records or requests pending.</td></tr>';
                return;
            }

            teamData.forEach(r => {
                const clean = (s) => (s && s.startsWith("'")) ? s.substring(1) : (s || '-');
                let inT = clean(r.inTime);
                let outT = clean(r.outTime);
                let breaks = clean(r.breaks);
                let status = clean(r.status);
                let leave = clean(r.leave);
                
                let stateBadge = '';
                
                let reqLocked = (status === 'Approved' && !isAdmin) ? 'disabled' : '';

                if (String(status||'').toLowerCase()==='approved') {
                    stateBadge = '<span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">Approved</span>';
                } else if (isHOD && (status === 'Pending' || leave !== '-')) {
                    stateBadge = `<select onchange="updateAttStatus(${r.rowIndex}, this.value, ${JSON.stringify(r.user)})" class="border border-[#7db0b1] rounded-md px-2 py-1 text-xs font-bold text-[#2a4d53] outline-none cursor-pointer focus:ring-1 focus:ring-[#259b94]">
                                    <option value="Pending" ${status==='Pending'?'selected':''}>Pending Req</option>
                                    <option value="Approved" ${status==='Approved'?'selected':''}>Approve</option>
                                    <option value="Rejected" ${status==='Rejected'?'selected':''}>Reject</option>
                                  </select>`;
                } else {
                    stateBadge = `<span class="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">Present</span>`;
                }

                if (isHOD) {
                    stateBadge += ` <button onclick="openAttendanceEditModal(${r.rowIndex}, ${JSON.stringify(r.user)})" class="ml-2 bg-[#2a4d53] hover:bg-[#112a2e] text-white px-2 py-1 rounded text-xs font-bold" title="Admin correction"><i class="fas fa-edit"></i> Edit</button>`;
                }

                let rowBg = (isHOD && status === 'Pending') ? "bg-[#fffbeb]" : "hover:bg-gray-50";

                tbody.innerHTML += `
                    <tr class="transition ${rowBg} border-b">
                        <td class="py-4 px-6 font-bold text-gray-800 flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-[#e1ebea] flex items-center justify-center text-[#2a4d53] text-xs overflow-hidden">${r.profilePhotoUrl?`<img src="${r.profilePhotoUrl}" class="w-full h-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`:''}<i class="fas fa-user" style="${r.profilePhotoUrl?'display:none':''}"></i></div>
                            ${r.date}<br><span class="text-xs text-[#259b94]">${r.user}</span>
                        </td>
                        <td class="py-4 px-6 text-green-600 font-semibold">${inT}</td>
                        <td class="py-4 px-6 text-red-500 font-semibold">${outT}</td>
                        <td class="py-4 px-6 text-gray-500 text-xs max-w-[150px] truncate" title="${breaks} | ${clean(r.reason)}">${breaks}<br><span class="italic text-[#7db0b1]">${clean(r.reason)}</span></td>
                        <td class="py-4 px-6 text-center">${stateBadge}</td>
                    </tr>
                `;
            });
        }

        function updateTaskWeightage(rIdx, value, targetUser) {
            const w=Number(value); if(!Number.isFinite(w)||w<0||w>85){alert('Task weightage must be between 0 and 85%.');fetchDashboardDataSilently();return;}
            const fd=new FormData(); fd.append('action','updateTaskWeightage'); fd.append('rowIndex',rIdx); fd.append('weightage',w); if(targetUser)fd.append('targetUser',targetUser); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(data=>{if(data.status==='error')alert(data.message||'Weightage update rejected.');fetchDashboardDataSilently();}).catch(()=>alert('Weightage update failed.'));
        }

        function updateTaskDB(rIdx, type, val, targetUser) {
            const formData = new FormData();
            formData.append('action', 'updateTaskStatus');
            formData.append('rowIndex', rIdx);
            if(targetUser) formData.append('targetUser', targetUser);
            formData.append('type', type);
            formData.append('status', val);
            formData.append('sessionToken', sessionToken);

            fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if(data.status === 'error') { alert(data.message || 'Update rejected.'); return; }
                setTimeout(fetchDashboardDataSilently, 250);
            })
            .catch(() => alert('Update failed. Please try again.'));
        }

        function updateAttStatus(rIdx, val, targetUser) {
            const formData = new FormData();
            formData.append('action', 'updateAttStatus');
            formData.append('rowIndex', rIdx);
            if(targetUser) formData.append('targetUser', targetUser);
            formData.append('status', val);
            formData.append('sessionToken', sessionToken);
            fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if(data.status === 'error') { alert(data.message || 'Attendance update rejected.'); return; }
                setTimeout(fetchDashboardDataSilently, 250);
            })
            .catch(() => alert('Attendance update failed.'));
        }

        // ================= ADMIN ATTENDANCE CORRECTION =================
        function cleanDisplayValue(v) {
            if(v === null || v === undefined) return '';
            const s = String(v);
            return s.startsWith("'") ? s.substring(1) : s;
        }

        function openAttendanceEditModal(rowIndex, targetUser) {
            const teamRow = (globalTeamAttendance || []).find(r => Number(r.rowIndex) === Number(rowIndex) && (!targetUser || String(r.user).toLowerCase() === String(targetUser).toLowerCase()));
            let data = null;
            if(teamRow) {
                data = (globalMonthlyFullAttendance || []).find(a =>
                    String(a.Date) === String(teamRow.date) &&
                    String(a.Employee || '').toLowerCase() === String(teamRow.user || '').toLowerCase()
                );
            }

            document.getElementById('editAttRowIndex').value = rowIndex;
            document.getElementById('editAttTargetUser').value = targetUser || (teamRow ? teamRow.user : '');
            document.getElementById('editAttIn').value = data ? cleanDisplayValue(data.InTime) : cleanDisplayValue(teamRow?.inTime);
            document.getElementById('editAttOut').value = data ? cleanDisplayValue(data.OutTime) : cleanDisplayValue(teamRow?.outTime);
            document.getElementById('editAttBreakStart').value = data ? cleanDisplayValue(data.BreakStarts) : '';
            document.getElementById('editAttBreakEnd').value = data ? cleanDisplayValue(data.BreakEnds) : '';
            document.getElementById('editAttLeave').value = data ? cleanDisplayValue(data.Leave) : cleanDisplayValue(teamRow?.leave);
            document.getElementById('editAttReason').value = data ? cleanDisplayValue(data.Reason) : cleanDisplayValue(teamRow?.reason);
            document.getElementById('editAttStatus').value = cleanDisplayValue(data ? data.Status : teamRow?.status) || 'Pending';
            document.getElementById('attendanceEditModal').style.display = 'block';
        }
        function closeAttendanceEditModal() { document.getElementById('attendanceEditModal').style.display = 'none'; }

        function saveAttendanceCorrection() {
            const btn = document.getElementById('saveAttEditBtn');
            const fd = new FormData();
            fd.append('action','updateAttendanceRecord');
            fd.append('rowIndex',document.getElementById('editAttRowIndex').value);
            fd.append('targetUser',document.getElementById('editAttTargetUser').value);
            fd.append('inTime',document.getElementById('editAttIn').value);
            fd.append('outTime',document.getElementById('editAttOut').value);
            fd.append('breakStart',document.getElementById('editAttBreakStart').value);
            fd.append('breakEnd',document.getElementById('editAttBreakEnd').value);
            fd.append('leave',document.getElementById('editAttLeave').value);
            fd.append('reason',document.getElementById('editAttReason').value);
            fd.append('approvalStatus',document.getElementById('editAttStatus').value);
            fd.append('sessionToken',sessionToken);

            btn.disabled = true; btn.innerText = 'Saving...';
            apiFetchJson_(GOOGLE_SCRIPT_URL,{method:'POST',body:fd})
            .then(data=>{
                alert(data.message || 'Attendance updated.');
                btn.disabled=false; btn.innerText='Save Correction';
                if(data.status==='success') {
                    closeAttendanceEditModal();
                    fetchDashboardDataSilently();
                }
            })
            .catch(()=>{
                btn.disabled=false; btn.innerText='Save Correction';
                alert('Attendance correction failed.');
            });
        }

        // ================= HOD ASSIGN TASK =================
        // ================= ADMIN ATTENDANCE DATE LOCK =================
        function ensureAttendanceLockAdminUI(){
            if(!isFullAdminRole(document.getElementById('displayRole')?.innerText||''))return;
            if(document.getElementById('attendanceLockBtn'))return;
            const btn=document.createElement('button');btn.id='attendanceLockBtn';btn.type='button';btn.className='fixed right-5 bottom-5 z-[9998] bg-[#263f45] hover:bg-[#142c31] text-white px-4 py-3 rounded-xl shadow-lg font-bold text-sm';btn.innerHTML='<i class="fas fa-lock mr-2"></i>Attendance Date Lock';btn.onclick=openAttendanceDateLockModal;document.body.appendChild(btn);
        }
        function closeAttendanceDateLockModal(){document.getElementById('attendanceDateLockModal')?.remove();}
        function renderAttendanceDateLockRows(){
            const box=document.getElementById('attendanceDateLockRows');if(!box)return;const rows=[...(globalAttendanceDateLocks||[])].sort((a,b)=>String(b.key).localeCompare(String(a.key)));
            if(!rows.length){box.innerHTML='<div class="p-3 text-center text-gray-500">Abhi koi custom Lock/Unlock nahi hai.</div>';return;}
            box.innerHTML=rows.slice(0,50).map(r=>{const st=String(r.status||'').toUpperCase();return `<div class="flex items-center justify-between gap-2 border-b py-2 text-sm"><div><b>${String(r.scope||'').toUpperCase()}</b> • ${r.key} • <span class="text-[#259b94]">${r.targetUser||'ALL EMPLOYEES'}</span><br><span class="text-xs ${st==='UNLOCKED'?'text-green-600':'text-red-600'} font-bold">${st}</span> <span class="text-xs text-gray-400">${r.updatedBy||''}</span></div><button class="px-3 py-1 rounded-lg border text-xs font-bold" onclick="setAttendanceDateLock('${String(r.scope)}','${String(r.key)}','${st==='UNLOCKED'?'LOCKED':'UNLOCKED'}')">${st==='UNLOCKED'?'Lock':'Unlock'}</button></div>`}).join('');
        }
        function parseJsonResponseSafe_(response){
            return response.text().then(function(raw){
                try{return JSON.parse(raw);}catch(err){
                    const preview=String(raw||'').replace(/\s+/g,' ').slice(0,180);
                    throw new Error('Google Apps Script ne JSON ke bajaye HTML response diya. Web App ko latest version par redeploy karke Access: Anyone rakhein. Response: '+preview);
                }
            });
        }
        function lockApiRequest_(params, method){
            const query=new URLSearchParams(); Object.keys(params||{}).forEach(k=>{if(params[k]!==undefined&&params[k]!==null)query.append(k,String(params[k]));});
            if(method==='GET'){
                return fetch(GOOGLE_SCRIPT_URL+'?'+query.toString(),{method:'GET',cache:'no-store',credentials:'omit'}).then(parseJsonResponseSafe_);
            }
            const fd=new FormData(); Object.keys(params||{}).forEach(k=>{if(params[k]!==undefined&&params[k]!==null)fd.append(k,String(params[k]));});
            return fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store',credentials:'omit'}).then(function(r){
                return r.text().then(function(raw){
                    try{return JSON.parse(raw);}catch(_){
                        // Some Apps Script deployments return an HTML page for POST while GET works.
                        return fetch(GOOGLE_SCRIPT_URL+'?'+query.toString(),{method:'GET',cache:'no-store',credentials:'omit'}).then(parseJsonResponseSafe_);
                    }
                });
            });
        }
        function refreshAttendanceDateLocksUI(){
            return lockApiRequest_({action:'getAttendanceDateLocks',sessionToken:sessionToken},'POST').then(function(d){if(d.status!=='success')throw new Error(d.message||'Lock data load failed.');globalAttendanceDateLocks=Array.isArray(d.locks)?d.locks:[];setDateConstraints();setLogWorkDateConstraints();renderAttendanceDateLockRows();updateAttendanceNonWorkingDay();v4UpdateAttendanceAvailability();return globalAttendanceDateLocks;});
        }
        function applyAttendanceLockResult_(d){
            if(!d||d.status!=='success')throw new Error((d&&d.message)||'Lock update failed.');
            globalAttendanceDateLocks=Array.isArray(d.locks)?d.locks:[];
            setDateConstraints();setLogWorkDateConstraints();renderAttendanceDateLockRows();updateAttendanceNonWorkingDay();v4UpdateAttendanceAvailability();
            alert(d.message||'Lock/Unlock updated successfully.');
        }
        function getLockTargetUser_(){
            const v=document.getElementById('lockUserSelect')?.value||'__ALL__';
            return v==='__ALL__'?'':v;
        }
        function setAttendanceDateLock(scope,key,status){
            key=String(key||'').trim();if(!key){alert(scope==='month'?'Month select karein.':'Date select karein.');return;}
            const targetUser=getLockTargetUser_();
            lockApiRequest_({action:'setAttendanceDateLock',scope:scope,key:key,status:status,targetUser:targetUser,sessionToken:sessionToken},'POST').then(applyAttendanceLockResult_).catch(function(e){alert(e.message||'Lock update failed.');});
        }
        function setAttendanceDateLockRange(status){
            const from=String(document.getElementById('lockFromDate')?.value||'').trim(), to=String(document.getElementById('lockToDate')?.value||'').trim();
            if(!from||!to){alert('From Date aur To Date dono select karein.');return;}
            if(from>to){alert('From Date, To Date se pehle honi chahiye.');return;}
            const targetUser=getLockTargetUser_();
            lockApiRequest_({action:'setAttendanceDateLockRange',fromDate:from,toDate:to,status:status,targetUser:targetUser,sessionToken:sessionToken},'POST').then(applyAttendanceLockResult_).catch(function(e){alert(e.message||'Date range update failed.');});
        }
        function openAttendanceDateLockModal(){
            if(!isFullAdminRole(document.getElementById('displayRole')?.innerText||'')){alert('Only Admin can manage Attendance Date Lock.');return;}
            if(document.getElementById('attendanceDateLockModal')){refreshAttendanceDateLocksUI().catch(e=>alert(e.message));return;}
            const div=document.createElement('div');div.id='attendanceDateLockModal';div.className='fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';div.innerHTML=`<div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto p-6"><div class="flex justify-between items-center mb-5"><div><h2 class="text-xl font-bold text-[#17353b]"><i class="fas fa-lock text-[#259b94] mr-2"></i>Attendance Date Lock Management</h2><p class="text-xs text-gray-500 mt-1">Admin specific Date ya poore Month ko Lock / Unlock kar sakta hai.</p></div><button onclick="closeAttendanceDateLockModal()" class="text-gray-500 hover:text-red-600 text-2xl font-bold">&times;</button></div><div class="border rounded-xl p-4 mb-4"><h3 class="font-bold mb-2">User Control</h3><label class="text-sm font-semibold text-gray-600">Apply Lock / Unlock For</label><select id="lockUserSelect" class="w-full border rounded-lg p-2 mt-1"><option value="__ALL__">All Employees</option></select><p class="text-xs text-gray-500 mt-2">All Employees select karne par rule sabhi employees par apply hoga. Particular employee select karne par sirf us user par apply hoga.</p></div><div class="border rounded-xl p-4 mb-4"><h3 class="font-bold mb-2">Date Control — Full Month</h3><input id="lockMonthInput" type="month" class="w-full border rounded-lg p-2 mb-3"><div class="flex gap-2"><button onclick="setAttendanceDateLock('month',document.getElementById('lockMonthInput').value,'UNLOCKED')" class="flex-1 bg-green-600 text-white rounded-lg p-2 font-bold">Unlock Month</button><button onclick="setAttendanceDateLock('month',document.getElementById('lockMonthInput').value,'LOCKED')" class="flex-1 bg-red-600 text-white rounded-lg p-2 font-bold">Lock Month</button></div><p class="text-xs text-gray-500 mt-2">Pure month unlock/lock ke liye sirf Month &amp; Year select karein. Future dates unlock nahi hongi.</p></div><div class="border rounded-xl p-4 mt-4"><h3 class="font-bold mb-2">Date Range Control</h3><div class="grid md:grid-cols-2 gap-3"><div><label class="text-xs font-semibold text-gray-600">From Date</label><input id="lockFromDate" type="date" class="w-full border rounded-lg p-2 mt-1"></div><div><label class="text-xs font-semibold text-gray-600">To Date</label><input id="lockToDate" type="date" class="w-full border rounded-lg p-2 mt-1"></div></div><div class="flex gap-2 mt-3"><button onclick="setAttendanceDateLockRange('UNLOCKED')" class="flex-1 bg-green-600 text-white rounded-lg p-2 font-bold">Unlock Date Range</button><button onclick="setAttendanceDateLockRange('LOCKED')" class="flex-1 bg-red-600 text-white rounded-lg p-2 font-bold">Lock Date Range</button></div><p class="text-xs text-gray-500 mt-2">Example: 01/10/2026 se 15/10/2026 tak selected user ya All Employees ke liye unlock/lock karein.</p></div><div class="mt-5 border rounded-xl p-4"><h3 class="font-bold mb-2">Current Lock / Unlock Controls</h3><div id="attendanceDateLockRows" class="max-h-64 overflow-auto"></div></div></div>`;document.body.appendChild(div);const todayLock=localDateKey();const monthLock=todayLock.slice(0,7);['lockFromDate','lockToDate'].forEach(function(id){const el=document.getElementById(id);if(el)el.max=todayLock;});const monthEl=document.getElementById('lockMonthInput');if(monthEl)monthEl.max=monthLock;const sel=document.getElementById('lockUserSelect');(globalTeamMembers||[]).slice().sort().forEach(function(n){if(n)sel.innerHTML+=`<option value="${String(n).replace(/\"/g,'&quot;')}">${String(n)}</option>`;});refreshAttendanceDateLocksUI().catch(e=>alert(e.message));
        }

        function openUserManagementModal() {
            document.getElementById('userManagementModal').style.display = 'block';
            loadAdminUsers();
        }
        function setDisplayedProfilePhoto(url){
            const ph=document.getElementById('displayUserPhoto'),pf=document.getElementById('displayUserPhotoFallback');
            if(!ph||!pf)return;
            const raw=String(url||'').trim();
            if(!raw){ph.removeAttribute('src');ph.classList.add('hidden');pf.classList.remove('hidden');return;}
            let src=raw;
            const m=raw.match(/[?&]id=([^&]+)/i);
            if(raw.indexOf('drive.google.com')>-1 && m) src='https://drive.google.com/thumbnail?id='+encodeURIComponent(m[1])+'&sz=w400';
            if(raw.indexOf('drive.google.com/uc')>-1){ const mid=raw.match(/[?&]id=([^&]+)/i); if(mid) src='https://drive.google.com/thumbnail?id='+encodeURIComponent(mid[1])+'&sz=w400'; }
            ph.onerror=function(){
                const m2=raw.match(/[?&]id=([^&]+)/i);
                if(m2 && this.src.indexOf('/thumbnail?')===-1){this.src='https://drive.google.com/thumbnail?id='+encodeURIComponent(m2[1])+'&sz=w400';return;}
                this.classList.add('hidden');pf.classList.remove('hidden');
            };
            ph.src=src;
            ph.classList.remove('hidden');pf.classList.add('hidden');
        }
        function closeUserManagementModal() { document.getElementById('userManagementModal').style.display = 'none'; }
        function toggleAdminUserHod() {
            const role=document.getElementById('adminNewRole').value, hod=document.getElementById('adminNewHod');
            hod.disabled = role !== 'emp';
            if(role !== 'emp') hod.value='';
        }
        function loadAdminUsers() {
            const fd=new FormData(); fd.append('action','adminListUsers'); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(data=>{
                if(data.status!=='success'){ alert(data.message||'Unable to load users.'); return; }
                const hod=document.getElementById('adminNewHod'); hod.innerHTML='<option value="">-- Select HOD --</option>';
                (data.hods||[]).forEach(n=>hod.innerHTML+=`<option value="${n}">${n}</option>`);
                const body=document.getElementById('adminUsersBody'); body.innerHTML='';
                (data.users||[]).forEach(u=>{
                    const safe=encodeURIComponent(u.username);
                    const self=String(u.username||'').trim().toLowerCase()===String(document.getElementById('displayUser').innerText||'').trim().toLowerCase();
                    const action=self ? '<span class="text-xs text-gray-400 font-semibold">Protected</span>' : `<div class="flex flex-wrap gap-1"><button onclick="openEditUserModal(decodeURIComponent('${safe}'))" class="text-xs bg-[#e6fcf5] text-[#1f827c] border border-[#b2d8d8] px-2 py-1 rounded-md font-bold"><i class="fas fa-pen"></i> Edit</button><button onclick="toggleUserAccount('${safe}',${u.accountEnabled!==false})" class="text-xs ${u.accountEnabled!==false?'bg-amber-50 text-amber-700 border-amber-200':'bg-green-50 text-green-700 border-green-200'} border px-2 py-1 rounded-md font-bold">${u.accountEnabled!==false?'OFF':'ON'}</button><button onclick="deleteAdminUser('${safe}')" class="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-md font-bold"><i class="fas fa-trash"></i> Delete</button></div>`;
                    const webToggle=self ? `<span class="text-xs text-gray-400 font-semibold">Current Admin</span>` : `<label class="web-switch" title="Turn user Web Link ON/OFF"><input type="checkbox" ${u.webLinkEnabled!==false?'checked':''} onchange="toggleUserWebLink('${safe}',this.checked)"><span class="web-slider"></span></label>`;
                    body.innerHTML+=`<tr class="border-t"><td class="p-2 font-semibold">${u.username}</td><td class="p-2">${u.role}</td><td class="p-2">${u.department||'-'}</td><td class="p-2">${u.hod||'-'}</td><td class="p-2 text-xs">${u.emailAddress?`<a href="mailto:${u.emailAddress}" class="text-[#259b94] font-bold">${u.emailAddress}</a>`:'-'}</td><td class="p-2 text-xs">${u.contactNumber?`<a href="tel:${u.contactNumber}" class="text-[#259b94] font-bold">${u.contactNumber}</a>`:'-'}</td><td class="p-2 text-xs">${u.whatsappNumber?`<a target="_blank" href="https://wa.me/${String(u.whatsappNumber).replace(/\D/g,'')}" class="text-green-600 font-bold">${u.whatsappNumber}</a>`:'-'}</td><td class="p-2">${webToggle}</td><td class="p-2"><span class="font-bold ${u.accountEnabled!==false?'text-green-600':'text-red-600'}">${u.accountEnabled!==false?'ON':'OFF'}</span></td><td class="p-2 text-xs">${u.accessPermissions||'All / Not Set'}${u.attendanceEntryStart&&u.attendanceEntryEnd?`<br><span class="text-[#259b94]">Att: ${u.attendanceEntryStart} → ${u.attendanceEntryEnd}</span>`:''}</td><td class="p-2">${action}</td></tr>`;
                });
                toggleAdminUserHod();
            }).catch(()=>alert('Unable to load users.'));
        }
        function toggleUserWebLink(encodedUsername, enabled){
            const username=decodeURIComponent(encodedUsername);
            const fd=new FormData(); fd.append('action','adminSetWebLink'); fd.append('sessionToken',sessionToken); fd.append('username',username); fd.append('enabled',enabled?'true':'false');
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{
                if(d.status!=='success'){alert(d.message||'Web Link update failed.');loadAdminUsers();return;}
                loadAdminUsers();
            }).catch(()=>{alert('Web Link update failed.');loadAdminUsers();});
        }
        function toggleUserAccount(encodedUsername, currentEnabled){
            const username=decodeURIComponent(encodedUsername);
            const next=!currentEnabled;
            const label=next?'ON':'OFF';
            if(!confirm(username+' ka account '+label+' karna hai?'))return;
            const fd=new FormData(); fd.append('action','adminSetAccountStatus'); fd.append('sessionToken',sessionToken); fd.append('username',username); fd.append('enabled',next?'true':'false');
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{alert(d.message||'Account status updated.');if(d.status==='success')loadAdminUsers();}).catch(()=>alert('Account status update failed.'));
        }
        function deleteAdminUser(encodedUsername){
            const username=decodeURIComponent(encodedUsername);
            if(!confirm('Kya aap '+username+' ko User Management se permanently delete karna chahte hain? Employee backup/data sheet delete nahi hogi.'))return;
            const fd=new FormData(); fd.append('action','adminDeleteUser'); fd.append('sessionToken',sessionToken); fd.append('username',username);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{alert(d.message||'User delete status.');if(d.status==='success')loadAdminUsers();}).catch(()=>alert('User delete failed.'));
        }
        function mergeExistingEmployeeFiles(){
            if(!confirm('Existing employee files ko ek format mein merge karke Annual Backup folder mein move karna hai? Ye one-time migration hai.'))return;
            const fd=new FormData();fd.append('action','mergeExistingEmployeeFiles');fd.append('sessionToken',sessionToken);
            const btn=[...document.querySelectorAll('button')].find(b=>b.innerText&&b.innerText.includes('Merge Old Files'));if(btn){btn.disabled=true;btn.innerText='Merging...';}
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Merge complete.');if(d.errors&&d.errors.length)console.warn('Merge errors:',d.errors);}).catch(()=>alert('Merge request failed.')).finally(()=>{if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-code-merge"></i> Merge Old Files';}});
        }

        function openEditUserModal(username) {
            const fd=new FormData(); fd.append('action','adminGetUser'); fd.append('sessionToken',sessionToken); fd.append('username',username);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(data=>{
                if(data.status!=='success'){alert(data.message||'Unable to load user.');return;}
                const u=data.user||{};
                document.getElementById('editUserLogin').value=u.username||'';
                document.getElementById('editUserName').value=u.username||'';
                document.getElementById('editUserPassword').value='';
                document.getElementById('editUserEmailAddress').value=u.emailAddress||'';
                document.getElementById('editUserContactNumber').value=u.contactNumber||'';
                document.getElementById('editUserWhatsappNumber').value=u.whatsappNumber||'';
                document.getElementById('editUserName').value=u.displayName||u.username||'';
                document.getElementById('editUserDepartment').value=u.department||'';
                document.getElementById('editUserInTime').value=u.timeIn||'';
                document.getElementById('editUserOutTime').value=u.timeOut||'';
                document.getElementById('editAttendanceStart').value=u.attendanceEntryStart||'';
                document.getElementById('editAttendanceEnd').value=u.attendanceEntryEnd||'';
                document.getElementById('editOfficeLocation').value=u.officeLocation||''; document.getElementById('editOfficeAddress').value=u.officeAddress||''; document.getElementById('editPhotoUrl').value=u.profilePhotoUrl||'';
                const h=document.getElementById('editUserHod'); h.innerHTML='<option value="">-- Select HOD --</option>';
                (data.hods||[]).forEach(n=>h.innerHTML+=`<option value="${n}">${n}</option>`); h.value=u.hod||'';
                const access=String(u.accessPermissions||'').split(',').map(x=>x.trim().toLowerCase());
                document.querySelectorAll('.edit-admin-access').forEach(cb=>cb.checked=access.indexOf(cb.value.toLowerCase())>-1 || !u.accessPermissions);
                document.getElementById('editUserModal').style.display='block';
            }).catch(()=>alert('Unable to load user.'));
        }
        function closeEditUserModal(){ document.getElementById('editUserModal').style.display='none'; }
        function prepareProfilePhoto(file){
            return new Promise((resolve,reject)=>{
                if(!file){resolve(null);return;}
                if(!file.type || file.type.indexOf("image/")!==0){reject(new Error("Please select an image file."));return;}
                const reader=new FileReader();
                reader.onload=()=>{
                    const img=new Image();
                    img.onload=()=>{
                        const max=600, scale=Math.min(1,max/Math.max(img.width,img.height));
                        const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale));
                        const ctx=c.getContext("2d"); ctx.drawImage(img,0,0,c.width,c.height);
                        const dataUrl=c.toDataURL("image/jpeg",0.82);
                        resolve({base64:dataUrl.split(",")[1],mime:"image/jpeg",name:(file.name||"profile.jpg").replace(/\.[^.]+$/,".jpg")});
                    };
                    img.onerror=()=>reject(new Error("Photo read nahi ho saki.")); img.src=reader.result;
                };
                reader.onerror=()=>reject(new Error("Photo read nahi ho saki.")); reader.readAsDataURL(file);
            });
        }
        async function uploadSelectedProfilePhoto(inputId, username){
            const input=document.getElementById(inputId);
            if(!input || !input.files || !input.files[0]) return null;
            const photo=await prepareProfilePhoto(input.files[0]);
            const fd=new FormData(); fd.append("action","uploadProfilePhoto"); fd.append("sessionToken",sessionToken); fd.append("username",username); fd.append("photoBase64",photo.base64); fd.append("photoMime",photo.mime); fd.append("photoName",photo.name);
            const res=await fetch(GOOGLE_SCRIPT_URL,{method:"POST",body:fd}); const data=await res.json();
            if(data.status!=="success") throw new Error(data.message||"Photo upload failed.");
            return data.url||null;
        }

        async function submitEditUser(){
            const username=document.getElementById('editUserLogin').value;
            let uploadedPhotoUrl=null;
            try{ uploadedPhotoUrl=await uploadSelectedProfilePhoto('editPhotoFile',username); }catch(err){ alert(err.message||'Photo upload failed.'); return; }
            if(uploadedPhotoUrl) document.getElementById('editPhotoUrl').value=uploadedPhotoUrl;
            const fd=new FormData(); fd.append('action','adminUpdateUser'); fd.append('sessionToken',sessionToken); fd.append('username',username);
            fd.append('displayName',document.getElementById('editUserName').value.trim());
            fd.append('emailAddress',document.getElementById('editUserEmailAddress').value.trim());
            fd.append('contactNumber',document.getElementById('editUserContactNumber').value.trim());
            fd.append('whatsappNumber',document.getElementById('editUserWhatsappNumber').value.trim());
            fd.append('password',document.getElementById('editUserPassword').value.trim());
            fd.append('department',document.getElementById('editUserDepartment').value.trim());
            fd.append('hod',document.getElementById('editUserHod').value);
            fd.append('timeIn',document.getElementById('editUserInTime').value.trim());
            fd.append('timeOut',document.getElementById('editUserOutTime').value.trim());
            fd.append('attendanceEntryStart',document.getElementById('editAttendanceStart').value);
            fd.append('attendanceEntryEnd',document.getElementById('editAttendanceEnd').value); fd.append('officeLocation',document.getElementById('editOfficeLocation').value.trim()); fd.append('officeAddress',document.getElementById('editOfficeAddress').value.trim()); fd.append('profilePhotoUrl',document.getElementById('editPhotoUrl').value.trim());
            fd.append('accessPermissions',[...document.querySelectorAll('.edit-admin-access:checked')].map(x=>x.value).join(', '));
            const btn=document.getElementById('saveEditUserBtn'); btn.disabled=true; btn.innerText='Saving...';
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(data=>{
                if(data.status==='success'){alert(data.message||'User updated successfully.');closeEditUserModal();loadAdminUsers();fetchDashboardDataSilently();} else alert(data.message||'User update failed.');
            }).catch(()=>alert('User update failed.')).finally(()=>{btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Save User Changes';});
        }

        async function submitAdminUser() {
            const name=document.getElementById('adminNewUsername').value.trim(), login=document.getElementById('adminNewLogin').value.trim(), pass=document.getElementById('adminNewPassword').value.trim(), role=document.getElementById('adminNewRole').value, dept=document.getElementById('adminNewDepartment').value.trim(), hod=document.getElementById('adminNewHod').value, office=document.getElementById('adminNewOfficeTime').value.trim(), weekoff=document.getElementById('adminNewWeekoff').value;
            if(!name||!login||!pass||!dept){alert('User name, login username, password and department are required.');return;}
            if(role==='emp'&&!hod){alert('Please assign an HOD to the employee.');return;}
            const access=[...document.querySelectorAll('.admin-access:checked')].map(x=>x.value).join(', ');
            let uploadedPhotoUrl=null;
            try{ uploadedPhotoUrl=await uploadSelectedProfilePhoto('adminNewPhotoFile',login); }catch(err){ alert(err.message||'Photo upload failed.'); return; }
            const photoUrl=uploadedPhotoUrl || document.getElementById('adminNewPhotoUrl').value.trim();
            const fd=new FormData(); fd.append('action','adminCreateUser'); fd.append('sessionToken',sessionToken); fd.append('username',login); fd.append('displayName',name); fd.append('password',pass); fd.append('role',role); fd.append('department',dept); fd.append('hod',hod); fd.append('accessPermissions',access); fd.append('emailAddress',document.getElementById('adminNewEmailAddress').value.trim()); fd.append('contactNumber',document.getElementById('adminNewContactNumber').value.trim()); fd.append('whatsappNumber',document.getElementById('adminNewWhatsappNumber').value.trim()); fd.append('officeTime',office); fd.append('weekoff',weekoff); fd.append('officeLocation',document.getElementById('adminNewOfficeLocation').value.trim()); fd.append('officeAddress',document.getElementById('adminNewOfficeAddress').value.trim()); fd.append('profilePhotoUrl',photoUrl);
            const btn=document.getElementById('createUserBtn'); btn.disabled=true; btn.innerText='Creating...';
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(data=>{
                if(data.status==='success'){alert((data.message||'User created successfully.')+(data.masterSpreadsheetUrl?'\n\nMaster Users Sheet: '+data.masterSpreadsheetUrl:'')); document.getElementById('adminNewUsername').value=''; document.getElementById('adminNewLogin').value=''; document.getElementById('adminNewPassword').value=''; document.getElementById('adminNewDepartment').value=''; document.getElementById('adminNewHod').value=''; document.getElementById('adminNewPhotoUrl').value=''; document.getElementById('adminNewPhotoFile').value=''; loadAdminUsers();} else alert(data.message||'User creation failed.');
            }).catch(()=>alert('User creation failed.')).finally(()=>{btn.disabled=false;btn.innerHTML='<i class="fas fa-user-plus"></i> Create User';});
        }

        // ================= UNIVERSAL IMPORT CENTER =================
        let importCenterType='attendance';
        let importCenterRows=[];
        let importCenterFile=null;

        function openImportCenterModal(){
            importCenterType='attendance'; importCenterRows=[]; importCenterFile=null;
            const f=document.getElementById('importCenterFile'); if(f)f.value='';
            const sf=document.getElementById('importSelectedFile'); if(sf)sf.innerText='';
            const pv=document.getElementById('importPreview'); if(pv)pv.innerHTML='';
            selectImportType('attendance');
            document.getElementById('importCenterModal').style.display='block';
            bindImportCenterFileInput();
            setTimeout(applyImportRoleTabs,0);
        }
        function closeImportCenterModal(){document.getElementById('importCenterModal').style.display='none';}
        function applyImportRoleTabs(){
            const role=String(document.getElementById('displayRole')?.innerText||'').toLowerCase();
            const taskTab=document.getElementById('importTabTasks'),eventTab=document.getElementById('importTabEvents');
            if(taskTab)taskTab.style.display=role.includes('admin')?'block':'none';
            if(eventTab)eventTab.style.display=role.includes('admin')?'block':'none';
            if(!role.includes('admin') && importCenterType!=='attendance')selectImportType('attendance');
        }
        function selectImportType(type){
            importCenterType=type; importCenterRows=[]; importCenterFile=null;
            const f=document.getElementById('importCenterFile'); if(f)f.value='';
            document.getElementById('importSelectedFile').innerText='';
            document.getElementById('importPreview').innerHTML='';
            ['attendance','tasks','events'].forEach(t=>{const b=document.getElementById('importTab'+t.charAt(0).toUpperCase()+t.slice(1));if(b)b.classList.toggle('active',t===type);});
            resetConfirmImportButton();
        }
        function resetConfirmImportButton(){
            const b=document.getElementById('confirmImportBtn'); if(!b)return; b.disabled=true; b.className='bg-gray-300 text-gray-500 font-bold py-3 rounded-lg cursor-not-allowed'; b.innerHTML='<i class="fas fa-check"></i> Confirm Import';
        }
        function enableConfirmImportButton(){
            const b=document.getElementById('confirmImportBtn'); if(!b)return; b.disabled=false; b.className='bg-[#91d3ce] hover:bg-[#73c3bd] text-white font-bold py-3 rounded-lg shadow-md cursor-pointer'; b.innerHTML='<i class="fas fa-check"></i> Confirm Import';
        }
        function importExcelDate(v){
            if(v instanceof Date)return v.toISOString().slice(0,10);
            if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
            const x=String(v??'').trim();
            if(/^\d{2}\/\d{2}\/\d{4}$/.test(x)){const p=x.split('/');return `${p[2]}-${p[1]}-${p[0]}`;}
            return x;
        }
        function importExcelTime(v){
            if(v instanceof Date)return v.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
            if(typeof v==='number'&&v>=0&&v<1){const total=Math.round(v*86400),h=Math.floor(total/3600)%24,m=Math.floor((total%3600)/60),sec=total%60,ap=h>=12?'PM':'AM',hh=h%12||12;return `${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')} ${ap}`;}
            return String(v??'').trim();
        }
        function importPreviewRows(rows,label){
            const pv=document.getElementById('importPreview');
            pv.innerHTML=`<div class="bg-green-50 border border-green-200 rounded-lg p-3 font-semibold text-green-900">${rows.length} ${label} row(s) ready for import. Existing matching records will be synced without creating duplicate rows.</div>`;
            enableConfirmImportButton();
        }
        function handleImportCenterFile(file){
            if(!file)return;
            importCenterFile=file;
            document.getElementById('importSelectedFile').innerText='Selected: '+file.name;
            resetConfirmImportButton();
            const rd=new FileReader();
            rd.onload=function(ev){try{
                const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],arr=XLSX.utils.sheet_to_json(ws,{defval:''});
                if(!arr.length){document.getElementById('importPreview').innerHTML='<div class="bg-red-50 border border-red-200 rounded-lg p-3 font-semibold text-red-700">File mein data nahi hai.</div>';return;}
                if(importCenterType==='attendance'){
                    importCenterRows=arr.map(r=>({date:importExcelDate(r['Date']||r['date']),employee:String(r['Employee ID']||r['Employee']||r['Username']||r['username']||'').trim(),inTime:importExcelTime(r['In Time']||r['InTime']),outTime:importExcelTime(r['Out Time']||r['OutTime']),breakStart:importExcelTime(r['Break Start']||r['BreakStart']),breakEnd:importExcelTime(r['Break End']||r['BreakEnd']),leave:String(r['Leave/Weekoff']||r['Leave']||'').trim(),reason:String(r['Reason']||'').trim(),status:String(r['Approval Status']||'Approved').trim()})).filter(r=>r.date||r.employee);
                    if(!importCenterRows.length)throw new Error('Valid attendance rows nahi mili.');
                    importPreviewRows(importCenterRows,'attendance');
                } else if(importCenterType==='tasks'){
                    // Task import in Import Center is intentionally TEMPLATE import.
                    // One template can occupy multiple rows; rows are grouped by Template ID.
                    const hasTemplateFields=arr.some(r=>r['Task Name']||r['Template ID']||r['Template Name']||r['Work Name']||r['Work']);
                    if(!hasTemplateFields)throw new Error('Task Template format required: Template ID, Task Name aur Work Name columns check karein.');
                    importCenterRows=arr.map(r=>({
                        templateId:String(r['Template ID']||r['TemplateId']||r['Template']||'').trim(),
                        taskName:String(r['Task Name']||r['Template Name']||r['Task']||'').trim(),
                        category:String(r['Category']||r['Template Category']||'').trim(),
                        description:String(r['Description']||r['Task Description']||'').trim(),
                        priority:String(r['Priority']||'Normal').trim(),
                        weightage:Number(r['Weightage'])||10,
                        startDay:Number(r['Start Day']||r['StartDay']||1)||1,
                        endDay:Number(r['End Day']||r['EndDay']||r['Start Day']||1)||1,
                        active:String(r['Active']??'TRUE').trim().toLowerCase()!=='false' && String(r['Active']??'TRUE').trim()!=='0' && String(r['Active']??'TRUE').trim().toLowerCase()!=='off',
                        repeat:String(r['Repeat']||r['Frequency']||'Monthly').trim()||'Monthly',
                        work:{
                            category:String(r['Work Category']||r['Work Category Name']||r['Category']||'').trim(),
                            workName:String(r['Work Name']||r['Work']||'').trim(),
                            weightage:Number(r['Work Weightage']||r['WorkWeightage'])||0
                        }
                    })).filter(r=>r.taskName);
                    if(!importCenterRows.length)throw new Error('Valid Task Template rows nahi mili.');
                    const grouped={};
                    importCenterRows.forEach(r=>{
                        const key=(r.templateId||r.taskName).toLowerCase();
                        if(!grouped[key])grouped[key]=[];
                        grouped[key].push(r);
                    });
                    const templateCount=Object.keys(grouped).length;
                    const workCount=importCenterRows.filter(r=>r.work.workName).length;
                    document.getElementById('importPreview').innerHTML=`<div class="bg-green-50 border border-green-200 rounded-lg p-3 text-green-900"><b>${templateCount}</b> Task Template(s) aur <b>${workCount}</b> Work row(s) ready hain. Same Template ID/name wali rows ek hi template mein merge hongi.</div>`;
                    enableConfirmImportButton();
                } else {
                    importCenterRows=arr.map(r=>({eventName:String(r['Event Name']||r['Event']||'').trim(),fromDate:importExcelDate(r['From Date']||r['Date']),toDate:importExcelDate(r['To Date']||r['From Date']||r['Date']),type:String(r['Type']||'Office Closed').trim(),details:String(r['Details']||'').trim()})).filter(r=>r.eventName||r.fromDate);
                    if(!importCenterRows.length)throw new Error('Valid office event rows nahi mili.');
                    importPreviewRows(importCenterRows,'office event');
                }
            }catch(e){importCenterRows=[];document.getElementById('importPreview').innerHTML='<div class="bg-red-50 border border-red-200 rounded-lg p-3 font-semibold text-red-700">File format read nahi ho saka: '+escapeHtml(e.message)+'</div>';}};
            rd.readAsArrayBuffer(file);
        }
        async function confirmImportCenter(){
            if(!importCenterFile||!importCenterRows.length){alert('Pehle CSV / Excel file select karein.');return;}
            const btn=document.getElementById('confirmImportBtn'); btn.disabled=true; btn.innerText='Syncing...';
            try{
                let payloadRows=importCenterRows;
                let action=importCenterType==='attendance'?'bulkAttendanceUpload':importCenterType==='tasks'?'importCommonTaskTemplates':'uploadOfficeEvents';
                if(importCenterType==='tasks'){
                    // Backend importCommonTaskTemplates accepts one row per Work.
                    // Repeating the same Template ID makes all Work rows merge into one template.
                    const generatedIds={};
                    payloadRows=importCenterRows.map(r=>{
                        let tid=r.templateId;
                        if(!tid){
                            const key=r.taskName.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,28)||'template';
                            if(!generatedIds[key])generatedIds[key]='IMP_'+key.toUpperCase();
                            tid=generatedIds[key];
                        }
                        return {...r,templateId:tid,work:r.work};
                    });
                }
                const fd=new FormData(); fd.append('action',action); fd.append('rowsJson',JSON.stringify(payloadRows)); fd.append('sessionToken',sessionToken);
                const d=await fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json());
                if(d.failed&&d.failed.length)alert(d.failed.join('\n'));
                if(d.status==='success'){
                    const summary=importCenterType==='tasks'
                        ? 'Task Templates import completed.\nNew: '+(d.created||0)+'\nUpdated: '+(d.updated||0)
                        : 'Import & Sync completed.\nNew: '+(d.imported||0)+'\nUpdated: '+(d.updated||0)+'\nSkipped: '+(d.skipped||0)+'\nFailed: '+(d.failed?d.failed.length:0);
                    alert(d.message?d.message+'\n\n'+summary:summary);
                    document.getElementById('importCenterFile').value=''; importCenterRows=[]; importCenterFile=null; document.getElementById('importSelectedFile').innerText=''; document.getElementById('importPreview').innerHTML='';
                    closeImportCenterModal();
                    if(importCenterType==='tasks')refreshAssignTemplateData();
                    fetchDashboardDataSilently();
                } else { alert(d.message||'Import failed.'); enableConfirmImportButton(); }
            }catch(err){alert('Import / Sync failed: '+(err.message||''));enableConfirmImportButton();}
        }
        function downloadImportFormat(){
            const wb=XLSX.utils.book_new();
            if(importCenterType==='attendance'){
                const ws=XLSX.utils.json_to_sheet([{'Date':'2026-09-22','Employee ID':'EMP001','In Time':'09:30:00 AM','Out Time':'06:30:00 PM','Break Start':'02:00:00 PM','Break End':'02:30:00 PM','Leave/Weekoff':'','Reason':'','Approval Status':'Approved'}]);
                XLSX.utils.book_append_sheet(wb,ws,'Attendance'); XLSX.writeFile(wb,'Attendance_Import_Format.xlsx');
            } else if(importCenterType==='tasks'){
                // Exact Task Template import format. Repeat Template ID for each work row.
                const rows=[
                    {'Template ID':'TPL001','Task Name':'Client Follow-up','Category':'Calling','Description':'Daily client follow-up task','Priority':'Normal','Weightage':10,'Start Day':1,'End Day':31,'Active':'TRUE','Repeat':'Monthly','Work Category':'Calling','Work Name':'Member Follow-up','Work Weightage':50},
                    {'Template ID':'TPL001','Task Name':'Client Follow-up','Category':'Calling','Description':'Daily client follow-up task','Priority':'Normal','Weightage':10,'Start Day':1,'End Day':31,'Active':'TRUE','Repeat':'Monthly','Work Category':'Reporting','Work Name':'Daily Follow-up Report','Work Weightage':50},
                    {'Template ID':'TPL002','Task Name':'Weekly Review','Category':'Meeting','Description':'Weekly review template','Priority':'High','Weightage':15,'Start Day':1,'End Day':31,'Active':'TRUE','Repeat':'Monthly','Work Category':'Review','Work Name':'Weekly Team Review','Work Weightage':100}
                ];
                const ws=XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(wb,ws,'Task Templates'); XLSX.writeFile(wb,'Task_Template_Import_Format.xlsx');
            } else {
                const ws=XLSX.utils.json_to_sheet([{'Event Name':'Independence Day','From Date':'2026-08-15','To Date':'2026-08-15','Type':'National Holiday','Details':'Office Closed'}]);
                XLSX.utils.book_append_sheet(wb,ws,'Office Events'); XLSX.writeFile(wb,'Office_Events_Import_Format.xlsx');
            }
        }
        // Import Center file/drag-drop binding fix
        function bindImportCenterFileInput(){
            const input=document.getElementById('importCenterFile');
            const zone=document.getElementById('importDropZone');
            if(input && !input.dataset.bound){
                input.dataset.bound='1';
                input.addEventListener('change',function(){
                    const file=this.files&&this.files[0];
                    if(file)handleImportCenterFile(file);
                });
            }
            if(zone && !zone.dataset.bound){
                zone.dataset.bound='1';
                ['dragenter','dragover'].forEach(evt=>zone.addEventListener(evt,function(e){e.preventDefault();e.stopPropagation();zone.classList.add('ring-2','ring-[#7c3aed]');}));
                ['dragleave','drop'].forEach(evt=>zone.addEventListener(evt,function(e){e.preventDefault();e.stopPropagation();zone.classList.remove('ring-2','ring-[#7c3aed]');}));
                zone.addEventListener('drop',function(e){
                    const file=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
                    if(file)handleImportCenterFile(file);
                });
            }
        }
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindImportCenterFileInput);
        else bindImportCenterFileInput();

        function openTaskExcelModal(){document.getElementById('taskExcelFile').value='';document.getElementById('taskExcelPreview').innerHTML='';document.getElementById('taskExcelModal').style.display='block';}
        function closeTaskExcelModal(){document.getElementById('taskExcelModal').style.display='none';}
        function downloadTaskExcelTemplate(){
            const rows=[{
                'Employee Username':'employee1','Task Name':'Client Follow-up','Start Date':'2026-09-22','End Date':'2026-09-22','Priority':'Normal','Frequency':'One-time','Weightage':10,'Assigned By':'MasterAdmin','Category':'Calling','Work':'Member Follow-up','Work Weightage':100
            }];
            const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Tasks');XLSX.writeFile(wb,'Task_Upload_Format.xlsx');
        }
        function uploadTaskExcelOnce(){
            const f=document.getElementById('taskExcelFile').files[0];if(!f){alert('Excel file select karein.');return;}
            const rd=new FileReader();rd.onload=function(ev){try{
                const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],arr=XLSX.utils.sheet_to_json(ws,{defval:''});
                if(!arr.length){alert('Excel mein task data nahi hai.');return;}
                const dateVal=v=>{if(v instanceof Date)return v.toISOString().split('T')[0];if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}return String(v||'').trim();};
                const rows=arr.map(r=>({employee:String(r['Employee Username']||r['Employee ID']||r['Employee']||r['Username']||'').trim(),taskName:String(r['Task Name']||r['Task']||'').trim(),startDate:dateVal(r['Start Date']||r['Start']),endDate:dateVal(r['End Date']||r['End']),priority:String(r['Priority']||'Normal').trim(),frequency:String(r['Frequency']||'One-time').trim(),weightage:Number(r['Weightage'])||10,assignedBy:String(r['Assigned By']||'').trim(),category:String(r['Category']||'').trim(),work:String(r['Work']||'').trim(),workWeightage:Number(r['Work Weightage'])||0}));
                document.getElementById('taskExcelPreview').innerHTML=`<div class="bg-green-50 border border-green-200 rounded-lg p-3 font-semibold">${rows.length} task row(s) ready for one-time import.</div>`;
                const fd=new FormData();fd.append('action','bulkTaskUpload');fd.append('rowsJson',JSON.stringify(rows));fd.append('sessionToken',sessionToken);const btn=document.getElementById('uploadTaskExcelBtn');btn.disabled=true;btn.innerText='Uploading & Assigning...';
                fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Task import completed');if(d.failed&&d.failed.length)alert(d.failed.join('\n'));if(d.status==='success'){document.getElementById('taskExcelFile').value='';closeTaskExcelModal();fetchDashboardDataSilently();}}).catch(()=>alert('Task Excel upload failed.')).finally(()=>{btn.disabled=false;btn.innerText='Upload & Assign Tasks';});
            }catch(e){alert('Excel format read nahi ho saka: '+e.message);}};rd.readAsArrayBuffer(f);
        }

        function isTaskAssistantRole(role){ const r=String(role||'').toLowerCase().trim(); return r==='task assistant'||r==='taskadmin'||r==='task admin'||r==='assistant admin'||r==='assistant'; }
        function isFullAdminRole(role){ const r=String(role||'').toLowerCase().replace(/[^a-z0-9]/g,''); return r==='admin'||r==='masteradmin'||r==='superadmin'||r==='administrator'||r==='masteradministrator'; }
        function isManagerRole(role){ const r=String(role||'').toLowerCase(); return r.indexOf('hod')>-1 || isFullAdminRole(r) || isTaskAssistantRole(r); }

        function escapeHtml(v){
            return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
        }
        let assignTemplateCache = [];
        let assignEmployeeCache = [];

        function openAssignTaskModal() {
            document.getElementById('assignTaskModal').style.display = 'block';
            clearAssignEmployees();
            clearAssignTemplates();
            const details=document.getElementById('selectedTemplateDetails'); if(details)details.innerHTML='Template select karein. Date, frequency aur weightage template se automatically aayega.';
            refreshAssignTemplateData();
            setTimeout(()=>renderAssignTemplateSelect_(),0);
        }

        const QUICK_TEMPLATE_TYPES = {
            'Followup': ['Monthly Report','Event Report','Zimmedaran Details','Weekly Risala','User File','Others'],
            'File Work': ['Monthly Report','Event Report','Zimmedaran Details','Weekly Risala','User File','Master File - Report','Others'],
            'Meeting': ['Online Meeting','Physical Meeting'],
            'Outdoor': ['Qafila','Tarbiyati Ijtima','Others']
        };
        const QUICK_TEMPLATE_TYPE_OPTIONS = Object.keys(QUICK_TEMPLATE_TYPES);
        const QUICK_TEMPLATE_PRIORITY_OPTIONS = ['Medium','Normal','High','Urgent'];
        let quickTemplateDataCache = {templates:null, employees:null, loadedAt:0};
        const QUICK_TEMPLATE_CACHE_MS = 60000;
        function ensureQuickTemplatePriorityField(){
            const weight=document.getElementById('qtWeightage');
            if(!weight || document.getElementById('qtPriority')) return;
            const wrap=weight.closest('div');
            if(!wrap || !wrap.parentElement) return;
            const box=document.createElement('div');
            box.className='mt-3';
            box.innerHTML='<label class=\"block text-sm font-bold text-[#112a2e] mb-1\">Priority</label><select id=\"qtPriority\" class=\"w-full border border-gray-300 rounded-lg px-3 py-2 bg-white\"><option value=\"Medium\">Medium</option><option value=\"Normal\">Normal</option><option value=\"High\">High</option><option value=\"Urgent\">Urgent</option></select>';
            wrap.parentElement.insertBefore(box,wrap);
        }
        function resetQuickTemplateForm(){
            ensureQuickTemplatePriorityField();
            const type=document.getElementById('qtCategory');
            const cat=document.getElementById('qtName');
            const other=document.getElementById('qtOtherType');
            if(type){
                type.innerHTML='<option value="">-- Select Task Type --</option>'+
                    QUICK_TEMPLATE_TYPE_OPTIONS.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
                type.disabled=false;type.value='';
            }
            if(cat){cat.innerHTML='<option value="">-- Select Task Category --</option>';cat.disabled=true;cat.value='';}
            if(other){other.value='';other.classList.add('hidden');}
            setQuickTemplateFieldLabels_();
            ['qtTemplateId','qtFrequency','qtStartDay','qtEndDay'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
            const w=document.getElementById('qtWeightage');if(w)w.value='10';
            const p=document.getElementById('qtPriority');if(p){p.innerHTML=QUICK_TEMPLATE_PRIORITY_OPTIONS.map(v=>`<option value="${v}">${v}</option>`).join('');p.value='Normal';}
            const btn=document.getElementById('qtSaveBtn');if(btn){btn.innerText='Save Template';btn.dataset.mode='create';}
        }
        function openQuickTemplateModal(){
            const role=String(document.getElementById('displayRole')?.innerText||'').toLowerCase(); if(!isFullAdminRole(role)){alert('Task Template add karne ka access sirf Admin ko hai.');return;}
            resetQuickTemplateForm();updateQuickTemplateTaskTypes();document.getElementById('quickTemplateModal').style.display='block';setTimeout(renderQuickTemplateList,50);
        }
        function closeQuickTemplateModal(){const m=document.getElementById('quickTemplateModal');if(m)m.style.display='none';}
        function setQuickTemplateFieldLabels_(){
            const cat=document.getElementById('qtCategory'), type=document.getElementById('qtName');
            if(cat){const l=cat.closest('div')?.querySelector('label');if(l)l.textContent='Task Type';cat.setAttribute('aria-label','Task Type');}
            if(type){const l=type.closest('div')?.querySelector('label');if(l)l.textContent='Task Category';type.setAttribute('aria-label','Task Category');}
        }
        function getQuickTemplateTypeList_(){
            return [...new Set(Object.values(QUICK_TEMPLATE_TYPES||{}).flat().map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
        }
        function updateQuickTemplateTaskTypes(){
            const typeSel=document.getElementById('qtCategory');
            const catSel=document.getElementById('qtName');
            const other=document.getElementById('qtOtherType');
            if(!typeSel||!catSel)return;
            setQuickTemplateFieldLabels_();
            const currentType=typeSel.value;
            typeSel.innerHTML='<option value="">-- Select Task Type --</option>'+
                QUICK_TEMPLATE_TYPE_OPTIONS.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
            typeSel.disabled=false;
            if(QUICK_TEMPLATE_TYPE_OPTIONS.includes(currentType))typeSel.value=currentType;
            const categories=QUICK_TEMPLATE_TYPES[typeSel.value]||[];
            const currentCat=catSel.value;
            catSel.innerHTML='<option value="">-- Select Task Category --</option>'+
                categories.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
            catSel.disabled=!typeSel.value;
            if(typeSel.value && categories.includes(currentCat))catSel.value=currentCat;
            if(other){other.value='';other.classList.add('hidden');}
        }
        function handleQuickTemplateOtherType(){
            const type=document.getElementById('qtCategory'), other=document.getElementById('qtOtherType');
            if(!type||!other)return;
            const isOther=false;
            other.classList.toggle('hidden',!isOther);
            if(!isOther)other.value='';
        }
        function getQuickTemplateTaskType(){
            const type=document.getElementById('qtCategory')?.value||'';
            const other=document.getElementById('qtOtherType')?.value.trim()||'';
            return type;
        }
        document.addEventListener('change',function(e){
            if(e.target?.id==='qtCategory'){updateQuickTemplateTaskTypes();handleQuickTemplateOtherType();}
        });
        function editQuickTaskTemplate(t){
            document.getElementById('qtTemplateId').value=t.templateId||'';
            const type=document.getElementById('qtCategory'),cat=document.getElementById('qtName');
            setQuickTemplateFieldLabels_();
            updateQuickTemplateTaskTypes();
            const taskType=String(t.taskType||'');
            const taskCategory=String(t.category||t.taskName||'');
            updateQuickTemplateTaskTypes();
            type.value=QUICK_TEMPLATE_TYPE_OPTIONS.includes(taskType)?taskType:'';
            updateQuickTemplateTaskTypes();
            cat.value=(QUICK_TEMPLATE_TYPES[type.value]||[]).includes(taskCategory)?taskCategory:'';
            handleQuickTemplateOtherType();
            ensureQuickTemplatePriorityField();
            document.getElementById('qtFrequency').value=t.repeat||'Monthly';document.getElementById('qtStartDay').value=Number(t.startDay)||1;document.getElementById('qtEndDay').value=Number(t.endDay)||31;document.getElementById('qtWeightage').value=Number(t.weightage)||10;
            const priority=document.getElementById('qtPriority');if(priority)priority.value=['Medium','Normal','High','Urgent'].includes(String(t.priority||'Normal'))?String(t.priority||'Normal'):'Normal';
            const btn=document.getElementById('qtSaveBtn');btn.innerText='Update Template';btn.dataset.mode='edit';document.getElementById('quickTemplateModal').style.display='block';
        }
        function deleteQuickTaskTemplate(id,name){if(!id)return;if(!confirm(`Template "${name||id}" delete karna hai? Existing assigned tasks delete nahi honge.`))return;const fd=new FormData();fd.append('action','deleteCommonTaskTemplate');fd.append('templateId',id);fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{if(d.status!=='success')throw new Error(d.message||'Delete failed');alert(d.message||'Template deleted.');quickTemplateDataCache.loadedAt=0;refreshAssignTemplateData(false,true);renderQuickTemplateList();}).catch(e=>alert(e.message||'Template delete failed.'));}
        function renderQuickTemplateList(){const box=document.getElementById('quickTemplateList');if(!box)return;const list=(assignTemplateCache||[]).filter(t=>t.active!==false);if(!list.length){box.innerHTML='<div class="text-sm text-gray-500 p-3 border rounded-lg">No task templates found.</div>';return;}box.innerHTML=list.map(t=>`<div class="border border-gray-200 rounded-lg p-3 bg-gray-50"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><b class="text-sm text-[#112a2e]">${escapeHtml(t.taskName||'Task')}</b><div class="text-xs text-gray-500 mt-1">Type: ${escapeHtml(t.taskType||'-')} • Category: ${escapeHtml(t.category||'-')} • Frequency: ${escapeHtml(t.repeat||'Monthly')} • Priority: ${escapeHtml(t.priority||'Normal')}</div><div class="text-xs text-gray-500">Date: ${Number(t.startDay)||1} to ${Number(t.endDay)||31} • Weightage: ${Number(t.weightage)||0}%</div></div><div class="flex gap-1 shrink-0"><button type="button" data-tpl-edit="${escapeHtml(t.templateId||'')}" class="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">Edit</button><button type="button" data-tpl-delete="${escapeHtml(t.templateId||'')}" class="px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-bold">Delete</button></div></div></div>`).join('');
            box.querySelectorAll('[data-tpl-edit]').forEach(b=>b.onclick=()=>{const t=(assignTemplateCache||[]).find(x=>String(x.templateId)===String(b.dataset.tplEdit));if(t)editQuickTaskTemplate(t);});
            box.querySelectorAll('[data-tpl-delete]').forEach(b=>b.onclick=()=>{const t=(assignTemplateCache||[]).find(x=>String(x.templateId)===String(b.dataset.tplDelete));if(t)deleteQuickTaskTemplate(t.templateId,t.taskName);});
        }
        function saveQuickTaskTemplate(){
            ensureQuickTemplatePriorityField();
            const taskType=document.getElementById('qtCategory')?.value||'',
                category=document.getElementById('qtName')?.value||'',
                name=category,
                frequency=document.getElementById('qtFrequency')?.value||'',
                priority=document.getElementById('qtPriority')?.value||'Normal',
                startDay=Number(document.getElementById('qtStartDay')?.value),
                endDay=Number(document.getElementById('qtEndDay')?.value),
                weightage=Number(document.getElementById('qtWeightage')?.value);
            if(!taskType){alert('Task Type select karein.');return;}
            if(!category){alert('Task Category select karein.');return;}
            if(!frequency){alert('Task Frequency select karein.');return;}
            if(!Number.isInteger(startDay)||startDay<1||startDay>31){alert('From Date mein 1 se 31 tak day digit dein.');return;}
            if(!Number.isInteger(endDay)||endDay<1||endDay>31||endDay<startDay){alert('To Date mein valid day digit dein.');return;}
            if(!Number.isFinite(weightage)||weightage<0||weightage>100){alert('Task Weightage 0 se 100% ke beech hona chahiye.');return;}

            const btn=document.getElementById('qtSaveBtn');
            const templateId=document.getElementById('qtTemplateId')?.value||'';
            const optimisticId=templateId||('local_'+Date.now());
            const optimistic={
                templateId:optimisticId,taskName:name,taskType,category,repeat:frequency,
                priority,weightage,startDay,endDay,active:true,_optimistic:!templateId
            };
            btn.disabled=true;btn.innerText='Saving...';

            // Update UI immediately. The Apps Script write continues in the background,
            // so the Admin does not wait for the server round-trip to see the template.
            const list=Array.isArray(assignTemplateCache)?assignTemplateCache.slice():[];
            const idx=list.findIndex(x=>String(x.templateId)===String(optimisticId));
            if(idx>=0)list[idx]=Object.assign({},list[idx],optimistic);
            else list.unshift(optimistic);
            assignTemplateCache=list;
            quickTemplateDataCache.templates=list.slice();
            quickTemplateDataCache.loadedAt=Date.now();
            renderAssignTemplateSelect_();
            renderQuickTemplateList();
            resetQuickTemplateForm();
            closeQuickTemplateModal();
            btn.disabled=false;btn.innerText='Save Template';

            const fd=new FormData();
            fd.append('action','saveCommonTaskTemplate');
            fd.append('templateId',templateId);
            fd.append('taskName',name);
            fd.append('taskType',taskType);
            fd.append('category',category);
            fd.append('description','');
            fd.append('priority',priority);
            fd.append('weightage',String(weightage));
            fd.append('startDay',String(startDay));
            fd.append('endDay',String(endDay));
            fd.append('frequency',frequency);
            fd.append('active','true');
            fd.append('worksJson',JSON.stringify([{frequency,category,workName:name,weightage:100}]));
            fd.append('sessionToken',sessionToken);

            apiFetchJson_(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(d=>{
                if(d.status!=='success')throw new Error(d.message||'Template save failed');
                // Refresh once the backend write is confirmed; the immediate UI above
                // means the user never waits for this refresh.
                quickTemplateDataCache.loadedAt=0;
                setTimeout(()=>refreshAssignTemplateData(true,true),250);
            }).catch(e=>{
                // Roll back only the optimistic item when the server rejects a new save.
                if(!templateId){
                    assignTemplateCache=(assignTemplateCache||[]).filter(x=>String(x.templateId)!==String(optimisticId));
                    quickTemplateDataCache.templates=assignTemplateCache.slice();
                    renderAssignTemplateSelect_();
                    renderQuickTemplateList();
                }
                alert(e.message||'Template save failed.');
            });
        }

        function refreshAssignTemplateData(templatesOnly,forceRefresh){
            const tSel=document.getElementById('assignTemplateSelect');
            const eList=document.getElementById('assignEmployeeList');
            const nowMs=Date.now(),cacheFresh=quickTemplateDataCache.loadedAt && (nowMs-quickTemplateDataCache.loadedAt)<QUICK_TEMPLATE_CACHE_MS;
            const haveTemplates=Array.isArray(quickTemplateDataCache.templates),haveEmployees=Array.isArray(quickTemplateDataCache.employees);
            if(!forceRefresh&&cacheFresh&&haveTemplates&&(templatesOnly||haveEmployees)){
                assignTemplateCache=quickTemplateDataCache.templates.slice();
                if(!templatesOnly)assignEmployeeCache=quickTemplateDataCache.employees.slice();
                renderAssignTemplateSelect_();renderAssignEmployees();renderQuickTemplateList();return;
            }
            if(tSel&&!haveTemplates)tSel.innerHTML='<option value="">Loading templates...</option>';
            if(eList&&!templatesOnly&&!haveEmployees)eList.innerHTML='<div class="text-sm text-gray-500 p-2">Loading employees...</div>';
            const fd1=new FormData();fd1.append('action','getCommonTaskTemplates');fd1.append('sessionToken',sessionToken);
            const now=new Date(),ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');fd1.append('yearMonth',ym);
            const reqs=[apiFetchJson_(GOOGLE_SCRIPT_URL,{method:'POST',body:fd1})];
            if(!templatesOnly&&!haveEmployees){
                const fd2=new FormData();fd2.append('action','getCommonTaskEmployees');fd2.append('sessionToken',sessionToken);
                reqs.push(apiFetchJson_(GOOGLE_SCRIPT_URL,{method:'POST',body:fd2}));
            }
            Promise.all(reqs).then(results=>{
                const td=results[0],ed=results[1]||null;
                if(td.status!=='success')throw new Error(td.message||'Template load failed');
                quickTemplateDataCache.templates=Array.isArray(td.templates)?td.templates:[];
                assignTemplateCache=quickTemplateDataCache.templates.slice();
                if(ed){
                    if(ed.status!=='success')throw new Error(ed.message||'Employee load failed');
                    quickTemplateDataCache.employees=(ed.employees||[]).filter(x=>x&&x.active!==false&&x.accountEnabled!==false);
                    assignEmployeeCache=quickTemplateDataCache.employees.slice();
                }
                quickTemplateDataCache.loadedAt=Date.now();
                renderAssignTemplateSelect_();renderAssignEmployees();renderQuickTemplateList();
            }).catch(err=>{
                if(tSel&&!haveTemplates)tSel.innerHTML='<option value="">-- Select Task Template --</option>';
                if(eList&&!templatesOnly&&!haveEmployees)eList.innerHTML='<div class="text-sm text-red-500 p-2">Employee/Template list load nahi ho saki. Refresh karein.</div>';
            });
        }
        function renderAssignTemplateSelect_(){
            const tSel=document.getElementById('assignTemplateSelect');
            if(!tSel)return;
            const parent=tSel.parentElement;
            if(parent){
                parent.style.width='100%';
                parent.style.maxWidth='100%';
                parent.style.flex='1 1 100%';
            }
            tSel.innerHTML='<option value="">-- Select Task Template --</option>';
            (assignTemplateCache||[]).filter(x=>x.active!==false).forEach(t=>{
                tSel.innerHTML+=`<option value="${String(t.templateId).replace(/"/g,'&quot;')}">${escapeHtml(t.taskName||'Task')} — ${escapeHtml(t.taskType||'')} — ${escapeHtml(t.category||'')}</option>`;
            });

            // Multi-template picker: one action can assign any number of selected templates
            // to the same selected employees (or Select All employees).
            let box=document.getElementById('assignTemplateMultiBox');
            if(!box){
                box=document.createElement('div');
                box.id='assignTemplateMultiBox';
                box.className='mt-2 border border-gray-200 rounded-lg bg-white';
            box.style.width='100%';
            box.style.maxWidth='100%';
            box.style.boxSizing='border-box';
                tSel.insertAdjacentElement('afterend',box);
            }
            // Put the template actions in the top-right area of the Assign New Task
            // modal. The existing Refresh button is retained; Add Template sits beside it.
            const modal=document.getElementById('assignTaskModal');
            if(modal){
                const refreshBtn=[...modal.querySelectorAll('button')].find(b=>/refresh/i.test((b.textContent||'').trim()));
                if(refreshBtn){
                    const actionHost=refreshBtn.parentElement;
                    if(actionHost){
                        actionHost.style.display='flex';
                        actionHost.style.alignItems='center';
                        actionHost.style.justifyContent='flex-end';
                        actionHost.style.gap='10px';

                        // Keep exactly one Add Template button in the header.
                        [...modal.querySelectorAll('button')].filter(b=>{
                            const tx=(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
                            return tx.includes('add template') && !b.hasAttribute('data-assign-add-template');
                        }).forEach(b=>b.remove());

                        let addBtn=actionHost.querySelector('[data-assign-add-template]');
                        if(!addBtn){
                            addBtn=document.createElement('button');
                            addBtn.type='button';
                            addBtn.setAttribute('data-assign-add-template','1');
                            addBtn.className='px-4 py-2 rounded-lg bg-[#7c3aed] text-white font-bold';
                            addBtn.textContent='+ Add Template';
                            addBtn.onclick=()=>openQuickTemplateModal();
                            actionHost.appendChild(addBtn);
                        }

                        // Move the existing bottom Assign Task button into this same
                        // top-right action area. Do not create a duplicate button.
                        const assignBtn=document.getElementById('saveTaskBtn');
                        if(assignBtn){
                            assignBtn.type='button';
                            assignBtn.textContent='Assign Task';
                            assignBtn.className='px-5 py-2 rounded-lg bg-[#159e99] hover:bg-[#11857f] text-white font-bold shadow-sm';
                            assignBtn.style.margin='0';
                            assignBtn.onclick=submitNewTask;
                            actionHost.appendChild(assignBtn);
                        }
                    }
                }
            }

            box.innerHTML=`
                <div class="flex items-center justify-between gap-2 px-3 py-2 border-b bg-gray-50 w-full">
                    <div class="text-sm font-bold text-[#112a2e]">Select Templates</div>
                    <div class="flex gap-2">
                        <button type="button" onclick="selectAllAssignTemplates()" class="px-3 py-1 rounded bg-[#159e99] text-white text-xs font-bold">Select All</button>
                        <button type="button" onclick="clearAssignTemplates()" class="px-3 py-1 rounded bg-gray-100 text-gray-700 text-xs font-bold">Clear</button>
                    </div>
                </div>
                <div id="assignTemplateCheckboxList" class="max-h-52 overflow-y-auto p-2"></div>
                <div id="assignTemplateCount" class="px-3 py-2 text-xs text-gray-500">0 templates selected</div>`;
            const list=document.getElementById('assignTemplateCheckboxList');
            if(!list)return;
            const templates=(assignTemplateCache||[]).filter(x=>x.active!==false);
            if(!templates.length){
                list.innerHTML='<div class="text-sm text-gray-500 p-2">No active templates found.</div>';
                updateAssignTemplateCount(); return;
            }
            list.innerHTML=templates.map(t=>`
                <label class="flex items-center gap-3 p-2 rounded hover:bg-[#f0f8f8] cursor-pointer border-b border-gray-100">
                    <input type="checkbox" class="assign-template-check w-4 h-4"
                        value="${escapeHtml(t.templateId||'')}" onchange="updateAssignTemplateCount();updateSelectedTemplateDetails()">
                    <span class="min-w-0">
                        <b class="text-sm text-[#112a2e]">${escapeHtml(t.taskName||'Task')}</b>
                        <span class="block text-xs text-gray-500">${escapeHtml(t.taskType||'-')} • ${escapeHtml(t.category||'-')} • ${escapeHtml(t.repeat||'-')} • ${escapeHtml(t.priority||'Normal')}</span>
                    </span>
                </label>`).join('');
            tSel.style.display='none';
            updateAssignTemplateCount();
        }
        function getSelectedAssignTemplates(){
            return [...document.querySelectorAll('.assign-template-check:checked')].map(x=>x.value).filter(Boolean);
        }
        function selectAllAssignTemplates(){
            document.querySelectorAll('.assign-template-check').forEach(x=>x.checked=true);
            updateAssignTemplateCount(); updateSelectedTemplateDetails();
        }
        function clearAssignTemplates(){
            document.querySelectorAll('.assign-template-check').forEach(x=>x.checked=false);
            const s=document.getElementById('assignTemplateSelect');if(s)s.value='';
            updateAssignTemplateCount(); updateSelectedTemplateDetails();
        }
        function updateAssignTemplateCount(){
            const ids=getSelectedAssignTemplates();
            const legacy=document.getElementById('assignTemplateSelect');
            if(legacy)legacy.value=ids[0]||'';
            const n=ids.length;
            const el=document.getElementById('assignTemplateCount');
            if(el)el.textContent=n+' template'+(n===1?'':'s')+' selected';
        }
        function updateSelectedTemplateDetails(){
            const ids=getSelectedAssignTemplates();
            const details=document.getElementById('selectedTemplateDetails');
            if(!details)return;
            if(!ids.length){
                details.innerHTML='Template select karein. Date, frequency aur weightage template se automatically aayega.';
                return;
            }
            const selected=(assignTemplateCache||[]).filter(t=>ids.includes(String(t.templateId)));
            details.innerHTML=selected.map(t=>{
                const now=new Date(),y=now.getFullYear(),m=now.getMonth(),last=new Date(y,m+1,0).getDate();
                const sd=Math.min(Number(t.startDay)||1,last),ed=Math.min(Number(t.endDay)||sd,last);
                const start=`${y}-${String(m+1).padStart(2,'0')}-${String(sd).padStart(2,'0')}`;
                const end=`${y}-${String(m+1).padStart(2,'0')}-${String(ed).padStart(2,'0')}`;
                return `<div class="mb-2 pb-2 border-b last:border-b-0"><b>${escapeHtml(t.taskName||'Task')}</b> — ${escapeHtml(t.taskType||'-')} / ${escapeHtml(t.category||'-')} • ${escapeHtml(t.repeat||'-')} • ${escapeHtml(t.priority||'Normal')} • ${Number(t.weightage)||0}%<br><span class="text-xs text-gray-500">Date: ${start} to ${end}</span></div>`;
            }).join('');
        }

        function renderAssignEmployees(){
            assignEmployeeCache=(assignEmployeeCache||[]).filter(e=>e && e.active!==false && e.accountEnabled!==false);
            const box=document.getElementById('assignEmployeeList'); if(!box)return;
            if(!assignEmployeeCache.length){box.innerHTML='<div class="text-sm text-gray-500 p-2">No active employees found.</div>';updateAssignEmployeeCount();return;}
            box.innerHTML=assignEmployeeCache.map((e,i)=>{
                const id=escapeHtml(e.employeeId||'—'), name=escapeHtml(e.displayName||e.username||'Employee'), dept=escapeHtml(e.department||'Department not set');
                return `<label class="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f0f8f8] cursor-pointer border-b border-gray-100">
                    <input type="checkbox" class="assign-employee-check w-4 h-4" value="${escapeHtml(e.username||'')}" data-name="${name}" data-id="${id}" data-dept="${dept}" onchange="updateAssignEmployeeCount()">
                    <span class="min-w-0"><b class="text-sm text-[#112a2e]">${name}</b><span class="block text-xs text-gray-500">${id} • ${dept}</span></span>
                </label>`;
            }).join('');
            updateAssignEmployeeCount();
        }
        function selectAllAssignEmployees(){ document.querySelectorAll('.assign-employee-check').forEach(x=>x.checked=true); updateAssignEmployeeCount(); }
        function clearAssignEmployees(){ document.querySelectorAll('.assign-employee-check').forEach(x=>x.checked=false); updateAssignEmployeeCount(); }
        function getSelectedAssignEmployees(){ return [...document.querySelectorAll('.assign-employee-check:checked')].map(x=>x.value).filter(Boolean); }
        function updateAssignEmployeeCount(){ const n=getSelectedAssignEmployees().length; const el=document.getElementById('assignEmployeeCount'); if(el)el.textContent=n+' employee'+(n===1?'':'s')+' selected'; }

        function applyAssignTemplate(){
            const ids=getSelectedAssignTemplates();
            if(!ids.length){
                const id=document.getElementById('assignTemplateSelect')?.value||'';
                if(id)ids.push(id);
            }
            updateSelectedTemplateDetails();
        }

        function closeAssignTaskModal() { document.getElementById('assignTaskModal').style.display = 'none'; }
        
        function addTaskWorkRow(data={}) {
            const wrap=document.getElementById('taskWorksBuilder');
            const row=document.createElement('div'); row.className='grid grid-cols-12 gap-2 items-center task-work-row';
            row.innerHTML=`<input class="col-span-4 border border-gray-300 p-2 rounded-md text-xs task-work-category" placeholder="Category e.g. Calling" value="${data.category||''}">
                <input class="col-span-5 border border-gray-300 p-2 rounded-md text-xs task-work-name" placeholder="Work e.g. Member Follow-up" value="${data.work||''}">
                <input type="number" min="0" max="100" class="col-span-2 border border-gray-300 p-2 rounded-md text-xs task-work-weight" placeholder="Weight %" value="${data.weightage??''}">
                <button type="button" onclick="this.parentElement.remove()" class="col-span-1 bg-red-50 text-red-600 border border-red-200 rounded-md py-2 text-xs font-bold">×</button>`;
            wrap.appendChild(row);
        }
        function collectTaskWorks(){
            return [...document.querySelectorAll('#taskWorksBuilder .task-work-row')].map(r=>({category:r.querySelector('.task-work-category').value.trim(),work:r.querySelector('.task-work-name').value.trim(),weightage:Number(r.querySelector('.task-work-weight').value)||0})).filter(x=>x.category&&x.work);
        }

        async function submitNewTask(){
            let selectedTemplateIds=getSelectedAssignTemplates();
            const legacyId=document.getElementById('assignTemplateSelect')?.value||'';
            if(!selectedTemplateIds.length && legacyId)selectedTemplateIds=[legacyId];
            const selectedEmployees=getSelectedAssignEmployees();
            if(!selectedTemplateIds.length){alert('Kam az kam ek Task Template select karein.');return;}
            if(!selectedEmployees.length){alert('Kam az kam ek employee select karein.');return;}

            const selectedTemplates=(assignTemplateCache||[]).filter(x=>selectedTemplateIds.includes(String(x.templateId)));
            if(!selectedTemplates.length){alert('Selected Task Templates nahi mile.');return;}

            const now=new Date(),y=now.getFullYear(),m=now.getMonth(),last=new Date(y,m+1,0).getDate();
            const btn=document.getElementById('saveTaskBtn');
            btn.disabled=true;
            btn.innerText=`Assigning ${selectedTemplates.length} Template${selectedTemplates.length===1?'':'s'}...`;

            try{
                // One user action: each selected template is assigned to the same selected
                // employees. Requests run in parallel so multiple templates do not become
                // a slow serial process.
                const requests=selectedTemplates.map(t=>{
                    const sd=Math.min(Number(t.startDay)||1,last);
                    const ed=Math.min(Number(t.endDay)||sd,last);
                    const startDate=`${y}-${String(m+1).padStart(2,'0')}-${String(sd).padStart(2,'0')}`;
                    const endDate=`${y}-${String(m+1).padStart(2,'0')}-${String(ed).padStart(2,'0')}`;
                    const fd=new FormData();
                    fd.append('action','assignTemplateToEmployees');
                    fd.append('templateId',String(t.templateId));
                    fd.append('usernamesJson',JSON.stringify(selectedEmployees));
                    fd.append('startDate',startDate);
                    fd.append('endDate',endDate);
                    fd.append('priority',t.priority||'Normal');
                    fd.append('frequency',t.repeat||'One-time');
                    fd.append('taskType',t.taskType||'');
                    fd.append('category',t.category||'');
                    fd.append('taskCategory',t.category||'');
                    fd.append('weightage',String(Number(t.weightage)||10));
                    fd.append('assignedBy',document.getElementById('displayUser')?.innerText||'');
                    fd.append('sessionToken',sessionToken);
                    return apiFetchJson_(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(d=>{
                        if(d.status!=='success')throw new Error((t.taskName||'Template')+': '+(d.message||'Task assignment failed'));
                        return d;
                    });
                });
                const results=await Promise.all(requests);
                const assigned=results.reduce((n,d)=>n+Number(d.assigned||d.created||0),0);
                alert(`${selectedTemplates.length} template${selectedTemplates.length===1?'':'s'} selected employee${selectedEmployees.length===1?'':'s'} ko assign ho gaye.${assigned?`\nAssigned: ${assigned}`:''}`);
                clearAssignTemplates();
                clearAssignEmployees();
                fetchDashboardDataSilently();
            }catch(e){
                alert(e.message||'Task assignment failed.');
            }finally{
                btn.disabled=false;
                btn.innerText='Assign Task';
            }
        }

        // ================= EMP LOG DAILY WORK =================
        document.addEventListener('change',function(e){
            if(e.target?.id==='logWorkDate'){
                syncLogWorkDateDisplay();
                const c=document.getElementById('logTaskCategorySelect');
                populateLogWorkCategories_(globalAllTasks);
                populateLogTaskDropdown(globalAllTasks,e.target.value,c?.value||'');
                updateLogWorkDateUI();
            }
            if(e.target?.id==='logTaskSelect'){
                // Selecting a task populates Task Type + Task Category without
                // rebuilding/resetting the Task dropdown.
                setLogTaskMetaFromSelectedTask_();
                updateCompletionCheckboxState();
                updateLogTaskTemplateMeta();
            }
            if(e.target?.id==='requestBeforeCompletion' && e.target.checked){const done=document.getElementById('markTaskCompleted');if(done)done.checked=false;}
            if(e.target?.id==='markTaskCompleted' && e.target.checked){const before=document.getElementById('requestBeforeCompletion');if(before)before.checked=false;}
        });

        function updateLogDailyWorkButtonState(){
            const btn=document.getElementById('logDailyWorkBtn'); if(!btn)return;
            const key=document.getElementById('attendanceDate')?.value||localDateKey();
            const reason=isLogWorkNonWorkingDate(key);
            const allowed=isLogWorkDateAllowed(key);
            const rangeReason=!allowed?'Log Daily Work 01-Oct-2026 se aaj tak available hai. Future date allowed nahi hai.':'';
            const frozen=!!reason||!allowed;
            btn.disabled=frozen; btn.classList.toggle('opacity-50',frozen); btn.classList.toggle('cursor-not-allowed',frozen);
            btn.title=reason?`Log Daily Work frozen: ${reason}`:(rangeReason||'Log Daily Work');
        }
        // Today Urgent Task is available only when the office is open for the employee today.
        // Weekoff, approved Leave and Office Closed/Holiday days keep the button frozen.
        function updateTodayUrgentTaskButtonState(){
            const btn=document.getElementById('todayUrgentTaskBtn') || document.querySelector('button[onclick="openEmergencyTaskModal()"]');
            if(!btn)return;
            const todayKey=localDateKey();
            const selectedKey=document.getElementById('attendanceDate')?.value||todayKey;
            const reason=isLogWorkNonWorkingDate(todayKey);
            const previousDate=selectedKey!==todayKey;
            const frozen=!!reason || previousDate;
            btn.disabled=frozen;
            btn.classList.toggle('opacity-50',frozen);
            btn.classList.toggle('cursor-not-allowed',frozen);
            btn.title=previousDate?'Today Urgent Task sirf current date par available hai.':(reason?`Today Urgent Task frozen: ${reason}`:'Today Urgent Task');
        }
        function formatLogDateDisplay(dateKey){
            const s=String(dateKey||'').trim();
            const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if(!m)return s;
            const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return `${Number(m[3])}-${months[Number(m[2])-1]}-${m[1]}`;
        }
        function upgradeLogWorkDateDisplay(){
            const el=document.getElementById('logWorkDate');
            if(!el || el.dataset.displayUpgraded==='1')return;
            el.dataset.displayUpgraded='1';
            el.type='hidden';
            const wrap=document.createElement('div');
            wrap.className='relative';
            const display=document.createElement('input');
            display.type='text';
            display.id='logWorkDateDisplay';
            display.readOnly=true;
            display.className=el.className || 'w-full border rounded-lg p-2';
            display.setAttribute('aria-label','Select Date');
            display.placeholder='1-Oct-2026';
            const picker=document.createElement('input');
            picker.type='date';
            picker.id='logWorkDatePicker';
            picker.className='absolute inset-0 w-full h-full opacity-0 cursor-pointer';
            picker.setAttribute('aria-label','Select Date');
            wrap.appendChild(display);
            wrap.appendChild(picker);
            el.parentNode.insertBefore(wrap,el);
            function syncDisplay(){
                display.value=formatLogDateDisplay(el.value);
                picker.value=el.value||'';
            }
            picker.addEventListener('change',function(){
                el.value=picker.value;
                syncDisplay();
                el.dispatchEvent(new Event('change',{bubbles:true}));
            });
            display.addEventListener('click',function(){try{picker.showPicker();}catch(e){picker.focus();}});
            syncDisplay();
        }
        function syncLogWorkDateDisplay(){
            const el=document.getElementById('logWorkDate'),display=document.getElementById('logWorkDateDisplay'),picker=document.getElementById('logWorkDatePicker');
            if(!el)return;
            if(display)display.value=formatLogDateDisplay(el.value);
            if(picker)picker.value=el.value||'';
        }
        function openLogWorkModal() {
            const modal=document.getElementById('logWorkModal'); if(!modal)return;
            upgradeLogWorkDateDisplay();
            setLogWorkDateConstraints();
            const dailyActionDate=document.getElementById('attendanceDate')?.value||localDateKey();
            const dateEl=document.getElementById('logWorkDate');
            if(dateEl) dateEl.value=dailyActionDate;
            syncLogWorkDateDisplay();
            const dateKey=dailyActionDate;
            const nonWorking=isLogWorkNonWorkingDate(dateKey);
            const allowed=isLogWorkDateAllowed(dateKey);
            if(isDateLockedClient(dateKey)){alert('Is date par Admin ne Work/Attendance LOCK kiya hua hai. Pehle Admin se UNLOCK karwayein.');return;}
            const btn=document.querySelector('button[onclick="openLogWorkModal()"]');
            if(nonWorking){ alert(`Log Daily Work frozen: ${nonWorking}.`); if(btn)btn.disabled=true; return; }
            if(!allowed){ alert('Log Daily Work 01-Oct-2026 se aaj tak available hai. Future date allowed nahi hai. Admin Lock/Unlock rules apply honge.'); if(btn)btn.disabled=true; return; }
            if(btn)btn.disabled=false;
            modal.style.display='block';
            removeLegacyLogTaskMetaSelectors_();
            ensureWorkLogsLoaded(true).catch(()=>{}).finally(()=>{syncAllTaskTimeSpentFromLogs_();populateLogTaskDropdown(globalAllTasks,dateKey);setLogTaskMetaFromSelectedTask_();updateCompletionCheckboxState();});
            if(document.getElementById('delayReason'))document.getElementById('delayReason').value='';
            const before=document.getElementById('requestBeforeCompletion'); if(before)before.checked=false;
            const done=document.getElementById('markTaskCompleted'); if(done)done.checked=false;
            updateBeforeCompletionUI();
        }
        function updateLogWorkDateUI(){
            const el=document.getElementById('logWorkDate'); if(!el)return;
            const key=el.value, nonWorking=isLogWorkNonWorkingDate(key), allowed=isLogWorkDateAllowed(key), hint=document.getElementById('logWorkDateHint');
            const modal=document.getElementById('logWorkModal');
            if(hint)hint.textContent=nonWorking?`Log Daily Work frozen: ${nonWorking}.`:(!allowed?'01-Oct-2026 se aaj tak ki date select karein.':'01-Oct-2026 se aaj tak Log Daily Work add kar sakte hain. Admin Lock/Unlock rules apply honge.');
            if(modal&&modal.style.display!=='none'&&(!allowed||nonWorking)){document.getElementById('logTaskSelect').innerHTML='<option value="">-- Log Daily Work Frozen --</option>';}
            else if(allowed&&!nonWorking)populateLogTaskDropdown(globalAllTasks,key);
            updateCompletionCheckboxState(); updateLogDailyWorkButtonState();
        }
        function updateBeforeCompletionUI(){
            const sel=document.getElementById('logTaskSelect'),wrap=document.getElementById('beforeCompletionWrap'),hint=document.getElementById('beforeCompletionHint'),cb=document.getElementById('requestBeforeCompletion');
            if(!sel||!wrap)return;
            const task=(globalAllTasks||[]).find(t=>String(t.rowIndex)===String(sel.value));
            const d=document.getElementById('logWorkDate')?.value||localDateKey(), due=task?parseReportDate(task.endDate):null, cur=parseLocalDateKey(d);
            const canBefore=!!task&&!!due&&!!cur&&cur<due&&String(task.empStatus||'').toLowerCase()!=='completed';
            wrap.classList.toggle('hidden',!canBefore); if(!canBefore&&cb)cb.checked=false; if(hint)hint.classList.toggle('hidden',!canBefore);
        }
        function updateCompletionCheckboxState(){
            const sel=document.getElementById('logTaskSelect'),cb=document.getElementById('markTaskCompleted'),wrap=document.getElementById('delayReasonWrap'),reason=document.getElementById('delayReason'); if(!sel||!cb)return;
            const task=(globalAllTasks||[]).find(t=>String(t.rowIndex)===String(sel.value)); if(!task){cb.disabled=true;cb.checked=false;if(wrap)wrap.classList.add('hidden');if(reason)reason.value='';updateBeforeCompletionUI();return;}
            const selectedDate=parseLocalDateKey(document.getElementById('logWorkDate')?.value||localDateKey()),due=parseReportDate(task.endDate),can=!!due&&!!selectedDate&&selectedDate.getTime()>=due.getTime();
            cb.disabled=!can;cb.title=can?'Closing approval request can be submitted on or after the task closing date.':'Before closing date use Before Completion request.';if(!can)cb.checked=false;
            const isDelayed=!!due&&!!selectedDate&&selectedDate.getTime()>due.getTime()&&String(task.empStatus||'').toLowerCase()!=='completed';
            if(wrap)wrap.classList.toggle('hidden',!isDelayed);if(!isDelayed&&reason)reason.value='';updateBeforeCompletionUI();
        }
        function closeLogWorkModal() { document.getElementById('logWorkModal').style.display = 'none'; }
        function submitWorkLog() {
            const taskSel=document.getElementById('logTaskSelect'), tIdx=taskSel.value, tName=taskSel.options[taskSel.selectedIndex]?.text||'', mins=document.getElementById('logTimeMins').value, desc=document.getElementById('logDesc').value, workDate=document.getElementById('logWorkDate')?.value||localDateKey(), username=document.getElementById('displayUser').innerText;
            const nonWorking=isLogWorkNonWorkingDate(workDate);
            if(!isLogWorkDateAllowed(workDate)){alert('Log Daily Work 01-Oct-2026 se aaj tak available hai. Future date allowed nahi hai. Admin Lock/Unlock rules apply honge.');return;}
            if(nonWorking){alert(`Log Daily Work frozen: ${nonWorking}.`);return;}
            if(!tIdx||!mins){alert('Please select task and enter time!');return;}
            const duplicateAlreadyLogged=(globalWorkLogs||[]).some(w=>{
                const d=String(w.WorkDate||w.workDate||'').trim();
                const r=String(w.TaskRowIndex||w.taskRowIndex||'').trim();
                const st=String(w.ApprovalStatus||w.approvalStatus||'Approved').trim().toLowerCase();
                return d===String(workDate).trim() && r===String(tIdx).trim() && st!=='rejected';
            });
            if(duplicateAlreadyLogged){
                alert('Yeh task aapne is date par already submit kar diya hai. Double entry allowed nahi hai.');
                populateLogTaskDropdown(globalAllTasks,workDate);
                return;
            }
            const before=!!document.getElementById('requestBeforeCompletion')?.checked;
            const done=!!document.getElementById('markTaskCompleted')?.checked;
            if(before&&done){alert('Before Completion aur Closing Request ek saath select nahi kar sakte.');return;}
            const btn=document.getElementById('saveLogBtn');btn.innerText='Saving...';btn.disabled=true;
            const formData=new FormData();formData.append('action','logWork');formData.append('username',username);formData.append('rowIndex',tIdx);formData.append('taskName',tName);formData.append('timeSpent',mins);formData.append('description',desc);formData.append('workDate',workDate);formData.append('delayReason',document.getElementById('delayReason')?.value.trim()||'');formData.append('markCompleted',done?'true':'false');formData.append('beforeCompletion',before?'true':'false');formData.append('clientTodayKey',localDateKey());formData.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:formData,cache:'no-store'}).then(async res=>{const text=await res.text();let data;try{data=JSON.parse(text);}catch(_){throw new Error('Backend response valid nahi hai. Google Apps Script Web App deployment check karein.');}return data;}).then(async data=>{alert(data.message||'Work log processed.');if(data.status==='success'){const savedTask=(globalAllTasks||[]).find(t=>String(t.rowIndex)===String(tIdx));if(savedTask&&data.timeSpentMins!==undefined)savedTask.timeSpent=Number(data.timeSpentMins)||0;btn.innerText='Save Log';btn.disabled=false;document.getElementById('logTimeMins').value='';document.getElementById('logDesc').value='';if(document.getElementById('delayReason'))document.getElementById('delayReason').value='';if(document.getElementById('delayReasonWrap'))document.getElementById('delayReasonWrap').classList.add('hidden');document.getElementById('markTaskCompleted').checked=false;if(document.getElementById('requestBeforeCompletion'))document.getElementById('requestBeforeCompletion').checked=false;await ensureWorkLogsLoaded(true).catch(()=>{});
                syncAllTaskTimeSpentFromLogs_();
                closeLogWorkModal();
                filterTasksByEmp();
                fetchDashboardDataSilently();}else{btn.innerText='Save Log';btn.disabled=false;}}).catch(e=>{alert(e.message||'Unable to save work log. Please try again.');btn.innerText='Save Log';btn.disabled=false;});
        }

        // ================= COMPREHENSIVE MONTHLY GRADE =================
        function calculateReportCard(tasks) {
            // Monthly grade must use the same server-configured performance weights
            // and only the current month's elapsed working days.
            let taskPerc = 0;
            let attPerc = 0;

            const taskList = Array.isArray(tasks) ? tasks : [];
            if (taskList.length > 0) {
                let comp = 0;
                taskList.forEach(t => {
                    if (String(t.empStatus || '').toLowerCase() === 'completed') comp++;
                });
                taskPerc = Math.round((comp / taskList.length) * 100);
            }

            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            let workingDays = 0;
            let presentDays = 0;
            const records = Array.isArray(globalMonthlyFullAttendance) ? globalMonthlyFullAttendance : [];
            const configuredWeekoffs = String(window.currentUserWeekoff || 'Sunday')
                .split(/[,;/]/)
                .map(x => x.trim().toLowerCase())
                .filter(Boolean);
            const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

            for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
                const dayName = dayNames[d.getDay()];
                if (configuredWeekoffs.includes(dayName)) continue;
                const officeEvent = typeof officeEventForDate === 'function' ? officeEventForDate(d) : null;
                if (officeEvent) continue;
                workingDays++;
                const score = getAttendanceScore(d, records);
                if (score === 100) presentDays++;
            }
            attPerc = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 100;

            const awRaw = Number(performanceWeights && performanceWeights.attendance);
            const twRaw = Number(performanceWeights && performanceWeights.task);
            const aw = Number.isFinite(awRaw) && awRaw >= 0 ? awRaw : 50;
            const tw = Number.isFinite(twRaw) && twRaw >= 0 ? twRaw : 50;
            const totalWeight = aw + tw || 100;
            let finalScore = Math.round((taskPerc * aw + attPerc * tw) / totalWeight);
            if (taskList.length === 0) finalScore = attPerc;

            let grade = 'D';
            let color = 'text-red-600';
            if (finalScore >= 90) { grade = 'A'; color = 'text-emerald-600'; }
            else if (finalScore >= 80) { grade = 'B'; color = 'text-blue-600'; }
            else if (finalScore >= 70) { grade = 'C'; color = 'text-amber-600'; }

            const mg = document.getElementById('monthlyGrade');
            if (mg) {
                mg.innerText = `${grade} (${grade === 'A' ? 'Mumtaz' : grade === 'B' ? 'Behtar' : grade === 'C' ? 'Munasib' : 'Kamzor'})`;
                mg.className = `text-3xl font-extrabold leading-tight break-words whitespace-normal overflow-hidden max-w-full px-1 ${color}`;
            }
            const monthlyPercEl = document.getElementById('monthlyPerc');
            if (monthlyPercEl) monthlyPercEl.innerText = `${finalScore}% Overall`;

            const taskPercEl = document.getElementById('taskPercText');
            const attPercEl = document.getElementById('attPercText');
            if (taskPercEl) taskPercEl.innerText = `${taskPerc}%`;
            if (attPercEl) attPercEl.innerText = `${attPerc}%`;

            const indivScoreEl = document.getElementById('indivScore');
            if (indivScoreEl) indivScoreEl.innerText = finalScore.toFixed(1);
            const deptScoreEl = document.getElementById('deptScore');
            if (deptScoreEl) deptScoreEl.innerText = (finalScore * 0.85).toFixed(1);
            const metricEfficiencyEl = document.getElementById('metricEfficiency');
            if (metricEfficiencyEl) metricEfficiencyEl.innerText = `${taskPerc}%`;
        }

        // ================= MONTHLY GRADE DETAILS =================
        function openMonthlyGradeDetails(){
            const role=String(document.getElementById('displayRole')?.innerText||window.currentUserRole||'').toLowerCase();
            if(role && !role.includes('employee') && !role.includes('emp')) return;
            const modal=document.getElementById('monthlyGradeDetailsModal');
            if(!modal) return;
            // Refresh the same calculation before showing details so the modal never shows stale values.
            try{ calculateReportCard(Array.isArray(globalAllTasks)?globalAllTasks:[]); }catch(e){}
            const task=(document.getElementById('taskPercText')?.innerText||'0%').trim();
            const att=(document.getElementById('attPercText')?.innerText||'0%').trim();
            const overall=(document.getElementById('indivScore')?.innerText||'0').trim();
            const grade=(document.getElementById('monthlyGrade')?.innerText||'-').trim();
            const set=(id,val)=>{const el=document.getElementById(id);if(el)el.innerText=val;};
            set('gradeDetailTask',task); set('gradeDetailAtt',att); set('gradeDetailOverall',overall==='-'?'-':overall+'%'); set('gradeDetailGrade',grade);
            modal.style.display='block';
        }
        function closeMonthlyGradeDetails(){
            const modal=document.getElementById('monthlyGradeDetailsModal');
            if(modal) modal.style.display='none';
        }

        // ================= V43 MANAGEMENT ANALYTICS =================
        let lastManagementAnalyticsData=null;
        async function openManagementAnalyticsModal(){
            const role=String(document.getElementById('displayRole')?.innerText||window.currentUserRole||'').toLowerCase();
            if(!(role.includes('admin')||role.includes('hod'))) return;
            const modal=document.getElementById('managementAnalyticsModal'); if(!modal)return;
            modal.style.display='block'; await loadManagementAnalytics();
        }
        function closeManagementAnalyticsModal(){const m=document.getElementById('managementAnalyticsModal');if(m)m.style.display='none';}
        async function loadManagementAnalytics(){
            const errEl=document.getElementById('managementAnalyticsError'); if(errEl){errEl.classList.add('hidden');errEl.innerText='';}
            const fd=new FormData(); fd.append('action','getManagementAnalytics'); fd.append('sessionToken',sessionToken);
            try{
                const r=await fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}); const d=await r.json();
                if(d.status!=='success') throw new Error(d.message||'Management Analytics load failed.');
                lastManagementAnalyticsData=d;
                const s=d.summary||{};
                const cards=[['Employees',s.employees||0],['Tasks',s.tasks||0],['Completed',s.completed||0],['Pending',s.pending||0],['Overdue',s.overdue||0],['Avg Task %',(s.avgTask||0)+'%'],['Avg Attendance %',(s.avgAttendance||0)+'%']];
                const box=document.getElementById('managementAnalyticsSummary'); if(box)box.innerHTML=cards.map(c=>`<div class="bg-white border rounded-xl p-3 shadow-sm"><div class="text-[10px] uppercase font-bold text-gray-500">${c[0]}</div><div class="text-xl font-extrabold text-[#112a2e] mt-1">${c[1]}</div></div>`).join('');
                const employees=Array.isArray(d.employees)?d.employees:[], top=document.getElementById('managementTopEmployees'), attention=document.getElementById('managementAttentionEmployees'), body=document.getElementById('managementEmployeeBody');
                const row=(x,i)=>`<tr class="border-t"><td class="p-3">${i+1}</td><td class="p-3 font-bold">${escapeHtml(x.name||x.username)}<div class="text-[10px] text-gray-500">${escapeHtml(x.employeeId||x.username)}</div></td><td class="p-3 text-center">${x.taskPercent}%</td><td class="p-3 text-center">${x.attendancePercent}%</td><td class="p-3 text-center font-extrabold">${x.overall}%</td><td class="p-3 text-center font-extrabold">${escapeHtml(x.grade)}</td></tr>`;
                if(top)top.innerHTML=employees.slice(0,10).map(row).join('')||'<tr><td colspan="6" class="p-5 text-center text-gray-500">No employee data.</td></tr>';
                if(attention)attention.innerHTML=(Array.isArray(d.attention)?d.attention:[]).map(x=>`<tr class="border-t"><td class="p-3 font-bold">${escapeHtml(x.name||x.username)}</td><td class="p-3 text-center text-red-600 font-bold">${x.overdue}</td><td class="p-3 text-center">${x.taskPercent}%</td><td class="p-3 text-center font-bold">${x.overall}%</td><td class="p-3 text-center font-bold">${escapeHtml(x.grade)}</td></tr>`).join('')||'<tr><td colspan="5" class="p-5 text-center text-gray-500">No immediate attention required.</td></tr>';
                if(body)body.innerHTML=employees.map(x=>`<tr class="border-t hover:bg-gray-50"><td class="p-3 font-bold">${escapeHtml(x.name||x.username)}<div class="text-[10px] text-gray-500">${escapeHtml(x.employeeId||x.username)}</div></td><td class="p-3">${escapeHtml(x.department||'-')}</td><td class="p-3 text-center">${x.tasks}</td><td class="p-3 text-center">${x.completed}</td><td class="p-3 text-center">${x.pending}</td><td class="p-3 text-center ${x.overdue?'text-red-600 font-bold':''}">${x.overdue}</td><td class="p-3 text-center">${x.taskPercent}%</td><td class="p-3 text-center">${x.onTimePercent}%</td><td class="p-3 text-center">${x.attendancePercent}%</td><td class="p-3 text-center font-extrabold">${x.overall}%</td><td class="p-3 text-center font-extrabold">${escapeHtml(x.grade)}</td></tr>`).join('')||'<tr><td colspan="11" class="p-5 text-center text-gray-500">No employee data.</td></tr>';
            }catch(err){if(errEl){errEl.classList.remove('hidden');errEl.innerText=err.message||'Management Analytics load failed.';}}
        }

        function exportManagementAnalyticsExcel(){
            const d=lastManagementAnalyticsData; if(!d||!Array.isArray(d.employees)){alert('Pehle Management Analytics load karein.');return;}
            if(typeof XLSX==='undefined'){alert('Excel module load nahi hua.');return;}
            const wb=XLSX.utils.book_new();
            const summary=[['Metric','Value'],['Employees',d.summary.employees],['Tasks',d.summary.tasks],['Completed',d.summary.completed],['Pending',d.summary.pending],['Overdue',d.summary.overdue],['Average Task %',d.summary.avgTask+'%'],['Average Attendance %',d.summary.avgAttendance+'%']];
            XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summary),'Summary');
            const rows=d.employees.map((x,i)=>({Rank:i+1,Employee:x.name||x.username,'Employee ID':x.employeeId||'',Department:x.department||'',Tasks:x.tasks,Completed:x.completed,Pending:x.pending,Overdue:x.overdue,'Task %':x.taskPercent+'%','On-Time %':x.onTimePercent+'%','Attendance %':x.attendancePercent+'%','Overall %':x.overall+'%',Grade:x.grade}));
            XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Employee Analysis');
            const att=(d.attention||[]).map(x=>({Employee:x.name||x.username,'Employee ID':x.employeeId||'',Department:x.department||'',Overdue:x.overdue,'Task %':x.taskPercent+'%','Overall %':x.overall+'%',Grade:x.grade}));
            XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(att),'Attention Required');
            XLSX.writeFile(wb,'Management_Analytics_Report_'+new Date().toISOString().slice(0,10)+'.xlsx');
        }
        async function generateManagementAnalyticsPDF(){
            const d=lastManagementAnalyticsData; if(!d||!Array.isArray(d.employees)){alert('Pehle Management Analytics load karein.');return;}
            try{
                if(!window.jspdf?.jsPDF){await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';sc.onload=resolve;sc.onerror=reject;document.head.appendChild(sc);});}
                const {jsPDF}=window.jspdf, doc=new jsPDF('l','mm','a4');
                doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('Office Task Reporting - Management Performance Report',14,15);
                doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('Generated: '+new Date().toLocaleString(),14,21);
                const s=d.summary||{};const summary=`Employees: ${s.employees||0} | Tasks: ${s.tasks||0} | Completed: ${s.completed||0} | Pending: ${s.pending||0} | Overdue: ${s.overdue||0} | Avg Task: ${s.avgTask||0}% | Avg Attendance: ${s.avgAttendance||0}%`;
                doc.text(summary,14,28);
                let y=37;doc.setFont('helvetica','bold');doc.text('Top Employees',14,y);y+=7;doc.setFont('helvetica','normal');
                d.employees.slice(0,12).forEach((x,i)=>{doc.text(`${i+1}. ${String(x.name||x.username).slice(0,28)} | Task ${x.taskPercent}% | Att ${x.attendancePercent}% | Overall ${x.overall}% | ${x.grade}`,16,y);y+=6;});
                y+=4;doc.setFont('helvetica','bold');doc.text('Attention Required',14,y);y+=7;doc.setFont('helvetica','normal');
                (d.attention||[]).slice(0,10).forEach(x=>{doc.text(`- ${String(x.name||x.username).slice(0,30)} | Overdue ${x.overdue} | Task ${x.taskPercent}% | Overall ${x.overall}% | ${x.grade}`,16,y);y+=6;});
                doc.addPage();doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Employee Analysis',14,15);doc.setFontSize(8);let yy=23;doc.text('Employee',14,yy);doc.text('Dept',72,yy);doc.text('Tasks',130,yy);doc.text('Comp',146,yy);doc.text('Pending',162,yy);doc.text('Overdue',180,yy);doc.text('Task%',198,yy);doc.text('Att%',214,yy);doc.text('Overall',230,yy);doc.text('Grade',250,yy);yy+=5;doc.setFont('helvetica','normal');
                d.employees.slice(0,28).forEach(x=>{doc.text(String(x.name||x.username).slice(0,28),14,yy);doc.text(String(x.department||'').slice(0,24),72,yy);doc.text(String(x.tasks),130,yy);doc.text(String(x.completed),146,yy);doc.text(String(x.pending),162,yy);doc.text(String(x.overdue),180,yy);doc.text(String(x.taskPercent)+'%',198,yy);doc.text(String(x.attendancePercent)+'%',214,yy);doc.text(String(x.overall)+'%',230,yy);doc.text(String(x.grade),250,yy);yy+=5;if(yy>190){doc.addPage();yy=15;}});
                doc.save('Management_Performance_Report_'+new Date().toISOString().slice(0,10)+'.pdf');
            }catch(e){alert('PDF report generate nahi hua: '+(e.message||e));}
        }

        // ================= EXCEL EXPORT (SHEETJS) =================
        function autoFitWorksheet(ws) {
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            const widths = [];
            for(let c = range.s.c; c <= range.e.c; c++) {
                let max = 10;
                for(let r = range.s.r; r <= range.e.r; r++) {
                    const cell = ws[XLSX.utils.encode_cell({r:r,c:c})];
                    if(cell && cell.v !== undefined) max = Math.max(max, String(cell.v).length + 2);
                }
                widths.push({wch: Math.min(max, 45)});
            }
            ws['!cols'] = widths;
        }


        function addAssignedTaskTypeColumn_(){
            const tables=[...document.querySelectorAll('table')];
            const table=tables.find(tb=>{
                const hs=[...tb.querySelectorAll('thead th')].map(x=>String(x.textContent||'').trim().toLowerCase());
                return hs.includes('task name') && hs.includes('task frequency') && hs.includes('time spent');
            });
            if(!table)return;

            const heads=[...table.querySelectorAll('thead th')];
            const normalizedHeads=heads.map(h=>String(h.textContent||'').trim().toLowerCase());
            const nameIdx=normalizedHeads.indexOf('task name');
            if(nameIdx<0)return;

            // Header: Task Type must be immediately before Task Name.
            let typeIdx=normalizedHeads.indexOf('task type');
            if(typeIdx<0){
                const th=document.createElement('th');
                th.textContent='Task Type';
                th.className=heads[nameIdx].className||'';
                heads[nameIdx].parentElement.insertBefore(th,heads[nameIdx]);
                typeIdx=nameIdx;
            }else if(typeIdx!==nameIdx-1){
                const th=heads[typeIdx];
                heads[nameIdx].parentElement.insertBefore(th,heads[nameIdx]);
                typeIdx=nameIdx-1;
            }

            const rows=[...table.querySelectorAll('tbody tr')];
            rows.forEach(row=>{
                const cells=[...row.children];
                if(!cells.length || cells.length===1)return;

                // The renderer now always creates a Task Type cell AND an Employee
                // placeholder cell (hidden for employees). Do not shift an already
                // correct row again. This repair is only for genuinely legacy rows.
                const headerCount=table.querySelectorAll('thead th').length;
                const headerCells=[...table.querySelectorAll('thead th')];
                const currentNameIdx=headerCells.findIndex(h=>String(h.textContent||'').trim().toLowerCase()==='task name');
                if(currentNameIdx<0)return;

                if(cells.length===headerCount)return;

                const textOf=(cell)=>String(cell?.textContent||'').trim().split('\n')[0].trim();
                const firstText=textOf(cells[0]);
                const nameAtExpected=textOf(cells[currentNameIdx]);

                // If the row is already aligned (including Task Type), never mutate it.
                // This specifically prevents Task Name/Frequency/Assigned By from shifting.
                const knownTasks=Array.isArray(globalAllTasks)?globalAllTasks:[];
                const matchesTaskName=(txt)=>{
                    if(!txt)return false;
                    const key=txt.toLowerCase();
                    return knownTasks.some(t=>String(t.taskName||'').trim().toLowerCase()===key);
                };

                // Legacy row without Task Type: its first cell is the Task Name.
                if(cells.length===headerCount-1 && matchesTaskName(firstText)){
                    const task=knownTasks.find(t=>String(t.taskName||'').trim().toLowerCase()===firstText.toLowerCase());
                    const type=task ? (task.taskType||task.templateTaskType||task.type||'-') : '-';
                    const td=document.createElement('td');
                    td.className=cells[0]?.className||'';
                    td.textContent=type;
                    row.insertBefore(td,cells[0]);
                }
            });

            table.dataset.taskTypeColumnAdded='1';
        }
        function observeAssignedTaskTypeColumn_(){
            addAssignedTaskTypeColumn_();
            if(window.__assignedTaskTypeObserver)return;
            const root=document.body;
            if(!root)return;
            const obs=new MutationObserver(()=>addAssignedTaskTypeColumn_());
            obs.observe(root,{childList:true,subtree:true});
            window.__assignedTaskTypeObserver=obs;
        }

        async function exportToExcel() {
            await ensureWorkLogsLoaded();
            if(typeof XLSX === 'undefined') {
                alert("Excel library is loading, please try again in a few seconds.");
                return;
            }

            let wb = XLSX.utils.book_new();

            // 1. Complete Assigned Tasks
            let tasksForExport = globalAllTasks.map(t => ({
                "Task ID": t.taskId,
                "Task Type": t.taskType || t.templateTaskType || t.type || "-",
                "Task Name": t.taskName,
                "Assigned To": t.assignedTo,
                "Department": t.department,
                "Start Date": t.startDate,
                "End Date": t.endDate,
                "Deadline Status": getDeadlineExportText(t.endDate, t.empStatus, t.completedAt),
                "Priority": t.priority,
                "Frequency": t.frequency,
                "Time Spent (Mins)": t.timeSpent,
                "Employee Status": t.empStatus,
                "HOD Approval": t.hodStatus,
                "Completed At": t.completedAt || ""
            }));
            let wsTasks = XLSX.utils.json_to_sheet(tasksForExport);
            autoFitWorksheet(wsTasks);
            XLSX.utils.book_append_sheet(wb, wsTasks, "Assigned Tasks");

            // 2. Complete Monthly Attendance
            let attForExport = globalMonthlyFullAttendance.map(a => ({
                "Date": a.Date,
                "Employee": a.Employee,
                "In Time": a.InTime,
                "Out Time": a.OutTime,
                "Break Start": a.BreakStarts,
                "Break End": a.BreakEnds,
                "Leave/Weekoff": a.Leave,
                "Reason": a.Reason,
                "Extra Break Minutes": a.ExtraBreakMinutes || 0,
                "Extra Break Reason": a.ExtraBreakReason || '',
                "HOD Status": a.Status
            }));
            let wsAtt = XLSX.utils.json_to_sheet(attForExport);
            autoFitWorksheet(wsAtt);
            XLSX.utils.book_append_sheet(wb, wsAtt, "Monthly Attendance");

            // 3. Daily Work Logs - time + task details
            let wsLogs = XLSX.utils.json_to_sheet(globalWorkLogs.map(w => ({
                "Date/Time": w.Date,
                "Work Date": w.WorkDate,
                "Employee": w.Employee,
                "Task": w.Task,
                "Time Spent (Mins)": w.TimeSpentMins,
                "Description": w.Description,
                "Approval Status": w.ApprovalStatus || 'Approved',
                "Reviewed By": w.ReviewedBy || '',
                "Reviewed At": w.ReviewedAt || '',
                "Rejection Reason": w.RejectionReason || '',
                "Task Row": w.TaskRowIndex
            })));
            autoFitWorksheet(wsLogs);
            XLSX.utils.book_append_sheet(wb, wsLogs, "Daily Work Logs");

            // 4. Performance Report
            let username = document.getElementById('displayUser').innerText;
            let grade = document.getElementById('monthlyGrade').innerText;
            const overallEl = document.getElementById('indivScore');
            let overall = overallEl ? overallEl.innerText : '-';
            let totalTime = (globalWorkLogs || []).filter(w => String(w.ApprovalStatus || 'Approved').toLowerCase() === 'approved').reduce((sum,w) => sum + (Number(w.TimeSpentMins) || 0), 0);
            let summaryData = [
                {"Metric": "Employee", "Value": username},
                {"Metric": "Overall Score", "Value": overall + "%"},
                {"Metric": "Overall Grade", "Value": grade},
                {"Metric": "Total Assigned Tasks", "Value": globalAllTasks.length},
                {"Metric": "Completed Tasks", "Value": globalAllTasks.filter(t => t.empStatus.toLowerCase() === 'completed').length},
                {"Metric": "Pending Tasks", "Value": globalAllTasks.filter(t => t.empStatus.toLowerCase() !== 'completed').length},
                {"Metric": "Total Logged Work (Mins)", "Value": totalTime},
                {"Metric": "WhatsApp Group", "Value": whatsappGroupLink || "Not Assigned"}
            ];
            let wsSummary = XLSX.utils.json_to_sheet(summaryData);
            autoFitWorksheet(wsSummary);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Performance Report");

            XLSX.writeFile(wb, "Zimmedar_Report_" + username.replace(/[^a-z0-9_-]/gi, "_") + ".xlsx");
        }

        function getDeadlineExportText(endDateStr, empStatus, completedAt) {
            if(!endDateStr || endDateStr === '-') return '-';
            const p = endDateStr.split('-');
            if(p.length !== 3) return endDateStr;
            const due = new Date(Number(p[2]), Number(p[1])-1, Number(p[0]));
            due.setHours(0,0,0,0);
            if((empStatus || '').toLowerCase() === 'completed' && completedAt) {
                const c = completedAt.split('-');
                if(c.length === 3) {
                    const done = new Date(Number(c[2]), Number(c[1])-1, Number(c[0]));
                    done.setHours(0,0,0,0);
                    const n = Math.round((due-done)/(1000*60*60*24));
                    return n < 0 ? n + " Days (Delayed)" : (n === 0 ? "0 Days (On Time)" : "+" + n + " Days (Early)");
                }
            }
            const today = new Date(); today.setHours(0,0,0,0);
            const n = Math.round((due-today)/(1000*60*60*24));
            return n < 0 ? n + " Days (Delayed)" : (n === 0 ? "0 Days (Due Today)" : "+" + n + " Days Left");
        }


        // ================= WHATSAPP REPORT =================
        function openWhatsAppReportModal() {
            document.getElementById('whatsappReportModal').style.display = 'block';
            const now = new Date();
            const todayKey = now.toISOString().split('T')[0];
            const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            const dailyInput = document.getElementById('whatsappReportDate');
            const monthInput = document.getElementById('whatsappReportMonth');
            dailyInput.max = todayKey;
            monthInput.max = monthKey;
            dailyInput.value = todayKey;
            monthInput.value = monthKey;
            const role = document.getElementById('displayRole').innerText;
            const isManager = isManagerRole(role);
            const empBox = document.getElementById('whatsappEmployeeBox');
            const empSelect = document.getElementById('whatsappEmpSelect');
            if(empBox) empBox.classList.toggle('hidden', !isManager);
            if(isManager && empSelect) { const f=document.getElementById('hodEmpFilter').value; if(f && f!=='All') empSelect.value=f; }
            const hint = document.getElementById('whatsappReportHint');
            if (hint) hint.innerText = whatsappGroupLink
                ? 'Assigned WhatsApp group will open automatically after the report is copied.'
                : 'No group is assigned yet. You can still share the report through WhatsApp.';
            toggleWhatsAppReportInputs();
            generateWhatsAppReportPreview();
            ensureWorkLogsLoaded().then(()=>generateWhatsAppReportPreview()).catch(()=>{});
        }
        function closeWhatsAppReportModal() { document.getElementById('whatsappReportModal').style.display = 'none'; }
        function toggleWhatsAppReportInputs() {
            const type = document.getElementById('whatsappReportType').value;
            document.getElementById('whatsappDailyBox').classList.toggle('hidden', type !== 'daily');
            document.getElementById('whatsappMonthlyBox').classList.toggle('hidden', type !== 'monthly');
            generateWhatsAppReportPreview();
        }

        function formatMinsForReport(mins) {
            mins = Number(mins) || 0;
            const h = Math.floor(mins / 60), m = mins % 60;
            return h > 0 ? `${h}h ${m}m (${mins} min)` : `${mins} min`;
        }

        function formatWhatsAppTime(value) {
            if (value === null || value === undefined || value === '') return '-';
            let s = String(value).trim();
            if (!s) return '-';

            if (s.includes('|')) {
                return s.split('|').map(v => formatWhatsAppTime(v)).join(' | ');
            }

            // Google Sheets / Apps Script Date serialized value, including 1899-12-30 time-only values.
            const iso = s.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
            if (iso) {
                let h = Number(iso[1]), m = Number(iso[2]);
                const ap = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`;
            }

            // Google Sheets may return a time as fraction of a day.
            if (/^\d*\.?\d+$/.test(s)) {
                const n = Number(s);
                if (n >= 0 && n < 1) {
                    const total = Math.round(n * 1440) % 1440;
                    let h = Math.floor(total / 60), m = total % 60;
                    const ap = h >= 12 ? 'PM' : 'AM';
                    h = h % 12 || 12;
                    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`;
                }
            }

            const tm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
            if (tm) {
                let h = Number(tm[1]), m = Number(tm[2]);
                const ap = tm[3] ? tm[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
                h = h % 12 || 12;
                return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`;
            }

            return s;
        }

        function getWhatsAppDailyGrade(user, dateKey) {
            const d = parseReportDate(dateKey);
            if (!d) return '-';

            const awRaw = Number(localStorage.getItem('zim_att_weight'));
            const twRaw = Number(localStorage.getItem('zim_task_weight'));
            const aw = Number.isFinite(awRaw) && Number.isFinite(twRaw) && awRaw + twRaw === 100 ? awRaw / 100 : 0.5;
            const tw = Number.isFinite(awRaw) && Number.isFinite(twRaw) && awRaw + twRaw === 100 ? twRaw / 100 : 0.5;

            const tasks = (globalAllTasks || []).filter(t =>
                String(t.assignedTo || '').trim().toLowerCase() === String(user).trim().toLowerCase()
            );
            const records = (globalMonthlyFullAttendance || []).filter(a =>
                String(a.Employee || '').trim().toLowerCase() === String(user).trim().toLowerCase()
            );

            const att = getAttendanceScore(d, records);
            const task = getTaskScore(tasks, d);

            if (att === null && task === null) return '-';
            let score;
            if (att !== null && task !== null) score = att * aw + task * tw;
            else if (att !== null) score = att;
            else score = task;

            const g = getGrade(score);
            return `${g[0]} (${g[1]})`;
        }

        function getWhatsAppMonthlyGrade(user) {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const awRaw = Number(localStorage.getItem('zim_att_weight'));
            const twRaw = Number(localStorage.getItem('zim_task_weight'));
            const aw = Number.isFinite(awRaw) && Number.isFinite(twRaw) && awRaw + twRaw === 100 ? awRaw / 100 : 0.5;
            const tw = Number.isFinite(awRaw) && Number.isFinite(twRaw) && awRaw + twRaw === 100 ? twRaw / 100 : 0.5;

            const tasks = (globalAllTasks || []).filter(t =>
                String(t.assignedTo || '').trim().toLowerCase() === String(user).trim().toLowerCase()
            );
            const records = (globalMonthlyFullAttendance || []).filter(a =>
                String(a.Employee || '').trim().toLowerCase() === String(user).trim().toLowerCase()
            );

            const result = periodScore(tasks, records, start, end, aw, tw);
            const g = getGrade(result.overall);
            return `${g[0]} (${g[1]})`;
        }

        function generateWhatsAppReportPreview() {
            const type = document.getElementById('whatsappReportType').value;
            const role = document.getElementById('displayRole').innerText.toLowerCase();
            const isManager = isManagerRole(role);
            const empSelect = document.getElementById('whatsappEmpSelect');
            const selectedEmp = isManager && empSelect ? empSelect.value : document.getElementById('displayUser').innerText;
            const user = selectedEmp || document.getElementById('displayUser').innerText || '-';
            const dept = document.getElementById('displayDept').innerText || '-';
            const line = '━━━━━━━━━━━━━━━━━━━━';

            let text = `📊 OFFICE ZIMMEDAR TASK REPORT\n${line}\n\n`;
            text += `👤 Employee: ${user}\n`;
            text += `🏢 Dept: ${dept}\n`;

            if (type === 'daily') {
                const raw = document.getElementById('whatsappReportDate').value;
                const todayKey = new Date().toISOString().split('T')[0];
                if(raw && raw > todayKey){ alert('Aaj ki date ke baad WhatsApp report generate nahi ho sakti.'); document.getElementById('whatsappReportDate').value=todayKey; return; }
                const p = raw ? raw.split('-') : [];
                const dateKey = p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '-';
                const dailyGrade = getWhatsAppDailyGrade(user, dateKey);

                text += `🏆 Daily Grade: ${dailyGrade}\n\n`;
                text += `📅 Date: ${dateKey}\n\n`;

                const att = (globalMonthlyFullAttendance || []).find(a =>
                    String(a.Date || '') === dateKey &&
                    String(a.Employee || '').trim().toLowerCase() === String(user).trim().toLowerCase()
                );

                text += `🕘 ATTENDANCE\n`;
                text += `• In Time: ${formatWhatsAppTime(att && att.InTime)}\n`;
                text += `• Out Time: ${formatWhatsAppTime(att && att.OutTime)}\n`;
                text += `• Break Start: ${formatWhatsAppTime(att && att.BreakStarts)}\n`;
                text += `• Break End: ${formatWhatsAppTime(att && att.BreakEnds)}\n`;
                text += `• Leave/Weekoff: ${att && att.Leave ? att.Leave : '-'}\n`;
                text += `• Reason: ${att && att.Reason ? att.Reason : '-'}\n`;
                function minsBetween(a,b){const fa=formatWhatsAppTime(a),fb=formatWhatsAppTime(b);const ma=fa.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i),mb=fb.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i);if(!ma||!mb)return 0;let ah=+ma[1]%12+(ma[4].toUpperCase()==='PM'?12:0),bh=+mb[1]%12+(mb[4].toUpperCase()==='PM'?12:0);let x=ah*60+ +ma[2]+(+ma[3]||0)/60,y=bh*60+ +mb[2]+(+mb[3]||0)/60;if(y<x)y+=1440;return y-x;}
                let breakTotal=0; if(att&&att.BreakStarts&&att.BreakEnds){const bs=String(att.BreakStarts).split('|'),be=String(att.BreakEnds).split('|');for(let bi=0;bi<Math.min(bs.length,be.length);bi++)breakTotal+=minsBetween(bs[bi],be[bi]);}
                text += `• Break Total Minutes: ${breakTotal}\n\n`;

                // Selected-date work logs only.
                const logs = (globalWorkLogs || []).filter(w =>
                    String(w.WorkDate || '') === dateKey &&
                    String(w.Employee || '').trim().toLowerCase() === String(user).trim().toLowerCase() &&
                    String(w.ApprovalStatus || 'Approved').toLowerCase() === 'approved'
                );

                // Tasks active on the selected date.
                const activeTasks = (globalAllTasks || []).filter(t => {
                    if (String(t.assignedTo || '').trim().toLowerCase() !== String(user).trim().toLowerCase()) return false;
                    const sd = parseReportDate(t.startDate);
                    const ed = parseReportDate(t.endDate);
                    const d = parseReportDate(dateKey);
                    return sd && ed && d && d >= sd && d <= ed;
                });

                // A task is "cleared" for this selected date only when it was completed on that date.
                const completedToday = activeTasks.filter(t =>
                    String(t.empStatus || '').toLowerCase() === 'completed' &&
                    String(t.completedAt || '') === dateKey
                );

                const workedTaskNames = new Set(
                    logs.map(w => String(w.Task || '').trim().toLowerCase()).filter(Boolean)
                );
                const workedToday = activeTasks.filter(t =>
                    workedTaskNames.has(String(t.taskName || '').trim().toLowerCase())
                );
                const pendingToday = activeTasks.filter(t =>
                    !completedToday.some(c => String(c.taskName || '').trim().toLowerCase() === String(t.taskName || '').trim().toLowerCase())
                );

                text += `📌 TASK SUMMARY\n`;
                text += `• Total Tasks: ${activeTasks.length}\n`;
                text += `• Clear/Completed: ${completedToday.length}\n`;
                text += `• Pending: ${pendingToday.length}\n`;
                text += `• Tasks Worked: ${workedToday.length}\n\n`;

                text += `📌 TASKS\n`;
                if (activeTasks.length) {
                    activeTasks.forEach((t, i) => {
                        const nameKey = String(t.taskName || '').trim().toLowerCase();
                        const done = completedToday.some(c => String(c.taskName || '').trim().toLowerCase() === nameKey);
                        const worked = workedTaskNames.has(nameKey);
                        const status = done ? '✅ Completed' : (worked ? '🔄 Worked' : '⏳ Pending');
                        const minsToday = logs
                            .filter(w => String(w.Task || '').trim().toLowerCase() === nameKey)
                            .reduce((sum, w) => sum + (Number(w.TimeSpentMins) || 0), 0);
                        const info = taskDeadlineInfo(t);

                        text += `${i + 1}. ${t.taskName || '-'}\n`;
                        text += `   • Status: ${status}\n`;
                        text += `   • Priority: ${t.priority || 'Normal'}\n`;
                        text += `   • Time Today: ${formatMinsForReport(minsToday)}\n`;
                        text += `   • Deadline: ${info.label}\n`; const delayLog=(logs||[]).find(w=>String(w.Task||'').trim().toLowerCase()===nameKey&&String(w.DelayReason||'').trim()); if(delayLog&&delayLog.DelayReason) text += `   • Delay Reason: ${delayLog.DelayReason}\n`; text += `\n`;
                    });
                } else {
                    text += `No task assigned for this date.\n\n`;
                }

                text += `📝 WORK DETAILS\n`;
                let totalMinutes = 0;
                if (logs.length) {
                    logs.forEach((w, i) => {
                        const mins = Number(w.TimeSpentMins) || 0;
                        totalMinutes += mins;
                        text += `${i + 1}. ${w.Task || '-'} — ${formatMinsForReport(mins)}\n`;
                        text += `   ↳ ${w.Description || 'No description'}\n\n`;
                    });
                } else {
                    text += `No office work log submitted for this date.\n\n`;
                }

                const totalTaskDuration=activeTasks.reduce((sum,t)=>sum+(Number(t.timeSpent)||0),0);
                text += `⏱️ Total Task Duration: ${formatMinsForReport(totalTaskDuration)}\n`;
                text += `⏱️ Total Office Work: ${formatMinsForReport(totalMinutes)}\n`;
            } else {
                const raw = document.getElementById('whatsappReportMonth').value;
                const nowMonth = new Date();
                const currentMonthKey = `${nowMonth.getFullYear()}-${String(nowMonth.getMonth()+1).padStart(2,'0')}`;
                if(raw && raw > currentMonthKey){ alert('Current month ke baad WhatsApp report generate nahi ho sakti.'); document.getElementById('whatsappReportMonth').value=currentMonthKey; return; }
                const p = raw ? raw.split('-') : [];
                const key = p.length === 2 ? `${p[1]}-${p[0]}` : '';
                const monthlyGrade = getWhatsAppMonthlyGrade(user);

                text += `🏆 Monthly Grade: ${monthlyGrade}\n\n`;
                text += `📅 Month: ${key || '-'}\n\n`;

                const rows = (globalMonthlyFullAttendance || []).filter(a => {
                    const d = String(a.Date || '').split('-');
                    return d.length === 3 &&
                        `${d[1]}-${d[2]}` === key &&
                        String(a.Employee || '').trim().toLowerCase() === String(user).trim().toLowerCase();
                });

                let present = 0, leave = 0, weekoff = 0, absent = 0;
                rows.forEach(a => {
                    const l = String(a.Leave || '').toLowerCase();
                    if (a.InTime) present++;
                    else if (l.includes('leave')) leave++;
                    else if (l.includes('weekoff')) weekoff++;
                    else absent++;
                });

                text += `🕘 ATTENDANCE SUMMARY\n`;
                text += `• Present: ${present}\n`;
                text += `• Absent: ${absent}\n`;
                text += `• Leave: ${leave}\n`;
                text += `• Weekoff: ${weekoff}\n\n`;

                const tasks = (globalAllTasks || []).filter(t =>
                    String(t.assignedTo || '').trim().toLowerCase() === String(user).trim().toLowerCase()
                );
                const completed = tasks.filter(t => String(t.empStatus || '').toLowerCase() === 'completed').length;

                text += `📌 TASK SUMMARY\n`;
                text += `• Total Tasks: ${tasks.length}\n`;
                text += `• Clear/Completed: ${completed}\n`;
                text += `• Pending: ${tasks.length - completed}\n\n`;

                text += `📌 TASKS\n`;
                tasks.forEach((t, i) => {
                    const info = taskDeadlineInfo(t);
                    text += `${i + 1}. ${t.taskName || '-'}\n`;
                    text += `   • Status: ${String(t.empStatus || '').toLowerCase() === 'completed' ? '✅ Completed' : '⏳ Pending'}\n`;
                    text += `   • Priority: ${t.priority || 'Normal'}\n`;
                    text += `   • Time: ${formatMinsForReport(Number(t.timeSpent) || 0)}\n`;
                    text += `   • Deadline: ${info.label}\n`; const delayLog=(logs||[]).find(w=>String(w.Task||'').trim().toLowerCase()===nameKey&&String(w.DelayReason||'').trim()); if(delayLog&&delayLog.DelayReason) text += `   • Delay Reason: ${delayLog.DelayReason}\n`; text += `\n`;
                });

                const logs = (globalWorkLogs || []).filter(w => {
                    const d = String(w.WorkDate || '').split('-');
                    return d.length === 3 &&
                        `${d[1]}-${d[2]}` === key &&
                        String(w.Employee || '').trim().toLowerCase() === String(user).trim().toLowerCase() &&
                        String(w.ApprovalStatus || 'Approved').toLowerCase() === 'approved';
                });

                let total = 0;
                text += `📝 WORK DETAILS\n`;
                if (logs.length) {
                    logs.forEach((w, i) => {
                        const mins = Number(w.TimeSpentMins) || 0;
                        total += mins;
                        text += `${i + 1}. ${w.WorkDate || '-'} | ${w.Task || '-'} — ${formatMinsForReport(mins)}\n`;
                        text += `   ↳ ${w.Description || 'No description'}\n\n`;
                    });
                } else {
                    text += `No work logs found.\n\n`;
                }

                text += `⏱️ Total Office Work: ${formatMinsForReport(total)}\n`;
            }

            text += `\n${line}\n🕒 Generated Msg : ${new Date().toLocaleString('en-IN',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true}).replace(/\//g,':')}`;
            const preview = document.getElementById('whatsappReportPreview');
            if (preview) preview.value = text;
        }

        document.addEventListener('change', function(e) {
            if(e.target && (e.target.id === 'whatsappReportDate' || e.target.id === 'whatsappReportMonth')) generateWhatsAppReportPreview();
            if(e.target && e.target.id === 'logTaskSelect') updateCompletionCheckboxState();
        });

        async function shareWhatsAppReport() {
            const type = document.getElementById('whatsappReportType').value;
            const todayKey = new Date().toISOString().split('T')[0];
            if(type === 'daily' && document.getElementById('whatsappReportDate').value > todayKey){ alert('Future date ki WhatsApp report allowed nahi hai.'); return; }
            if(type === 'monthly'){ const v=document.getElementById('whatsappReportMonth').value; const n=new Date(); const mk=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; if(v>mk){ alert('Future month ki WhatsApp report allowed nahi hai.'); return; } }
            const text = document.getElementById('whatsappReportPreview').value || '';
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const box = document.getElementById('whatsappReportPreview');
                    box.focus(); box.select();
                    document.execCommand('copy');
                }
            } catch(err) {
                const box = document.getElementById('whatsappReportPreview');
                box.focus(); box.select();
            }

            if (whatsappGroupLink) {
                window.open(whatsappGroupLink, '_blank', 'noopener,noreferrer');
                alert('Report copied. WhatsApp group opened. Paste the report and press Send.');
            } else {
                const shareUrl = 'https://wa.me/?text=' + encodeURIComponent(text);
                window.open(shareUrl, '_blank', 'noopener,noreferrer');
                alert('Report copied. WhatsApp opened. Select the required employee/group and press Send.');
            }
        }

        // ================= ATTENDANCE REQUEST / ONE-TIME IMPORT =================
        function openAttendanceRequestModal(){const d=document.getElementById('attReqDate'); if(d){const x=new Date(); d.value=x.toISOString().split('T')[0];} document.getElementById('attReqReason').value=''; document.getElementById('attendanceRequestModal').style.display='block';}
        function closeAttendanceRequestModal(){document.getElementById('attendanceRequestModal').style.display='none';}
        function submitAttendanceMissedRequest(){const date=document.getElementById('attReqDate').value,reason=document.getElementById('attReqReason').value.trim();if(!date||!reason){alert('Date aur reason required hai.');return;}const fd=new FormData();fd.append('action','submitAttendanceRequest');fd.append('date',date);fd.append('reason',reason);fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Request submitted');if(d.status==='success'){closeAttendanceRequestModal();fetchDashboardDataSilently();}}).catch(()=>alert('Attendance request failed.'));}
        function fillManagerAttendanceEmployees(){const s=document.getElementById('mgrAttEmployee');if(!s)return;s.innerHTML=(globalTeamMembers||[]).map(u=>`<option value="${String(u).replace(/"/g,'&quot;')}">${u}</option>`).join('');}
        function openManagerAttendanceModal(){fillManagerAttendanceEmployees();const d=document.getElementById('mgrAttDate');if(d)d.value=new Date().toISOString().split('T')[0];document.getElementById('managerAttendanceModal').style.display='block';}
        function closeManagerAttendanceModal(){document.getElementById('managerAttendanceModal').style.display='none';}
        function saveManagerAttendance(){const fd=new FormData();fd.append('action','adminSaveAttendance');fd.append('employee',document.getElementById('mgrAttEmployee').value);fd.append('date',document.getElementById('mgrAttDate').value);fd.append('inTime',document.getElementById('mgrAttIn').value.trim());fd.append('outTime',document.getElementById('mgrAttOut').value.trim());fd.append('breakStart',document.getElementById('mgrAttBreakStart').value.trim());fd.append('breakEnd',document.getElementById('mgrAttBreakEnd').value.trim());fd.append('leave',document.getElementById('mgrAttLeave').value.trim());fd.append('reason',document.getElementById('mgrAttReason').value.trim());fd.append('sessionToken',sessionToken);apiFetchJson_(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(d=>{alert(d.message||'Saved');if(d.status==='success'){closeManagerAttendanceModal();fetchDashboardDataSilently();}}).catch(e=>alert(e.message||'Attendance save failed.'));}
        function openOfficeEventsModal(){ document.getElementById('officeEventsModal').classList.add('active'); }
        function closeOfficeEventsModal(){ document.getElementById('officeEventsModal').classList.remove('active'); }
        function downloadOfficeEventsTemplate(){ const rows=[['Event Name','From Date','To Date','Type','Details'],['Independence Day','2026-08-15','2026-08-15','National Holiday','Office Closed'],['Eid','2026-06-17','2026-06-18','Religious Holiday','Office Closed']]; const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Office Events');XLSX.writeFile(wb,'Office_Events_Holidays_Format.xlsx'); }
        function uploadOfficeEventsOnce(){ const f=document.getElementById('officeEventsExcelFile').files[0]; if(!f){alert('Office Events ki Excel file select karein.');return;} const rd=new FileReader(); rd.onload=function(ev){try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],arr=XLSX.utils.sheet_to_json(ws,{defval:''}); if(!arr.length){alert('Excel mein data nahi hai.');return;} const excelDate=v=>{if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;} const x=String(v||'').trim();if(/^\d{2}\/\d{2}\/\d{4}$/.test(x)){const p=x.split('/');return `${p[2]}-${p[1]}-${p[0]}`;}return x;}; const rows=arr.map(r=>({eventName:r['Event Name']||r['Event']||'',fromDate:excelDate(r['From Date']||r['Date']),toDate:excelDate(r['To Date']||r['From Date']||r['Date']),type:r['Type']||'Office Closed',details:r['Details']||''})); document.getElementById('officeEventsPreview').innerHTML=`<div class="bg-purple-50 border border-purple-200 rounded-lg p-3 font-semibold">${rows.length} event row(s) ready for import.</div>`; const fd=new FormData();fd.append('action','uploadOfficeEvents');fd.append('rowsJson',JSON.stringify(rows));fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Office events imported.');document.getElementById('officeEventsExcelFile').value='';if(d.status==='success'){globalOfficeEvents=rows.concat(globalOfficeEvents||[]);updateAttendanceNonWorkingDay();closeOfficeEventsModal();fetchDashboardDataSilently();}if(d.failed&&d.failed.length)alert(d.failed.join('\n'));}).catch(()=>alert('Office Events upload failed.'));}catch(e){alert('Excel format read nahi ho saka: '+e.message);}};rd.readAsArrayBuffer(f); }

        function downloadAttendanceExcelTemplate(){const rows=[['Date','Employee ID','In Time','Out Time','Break Start','Break End','Leave/Weekoff','Reason','Approval Status'],['2026-09-21','EMP001','09:30:00 AM','06:30:00 PM','','','','Manual Entry','Approved']];const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Attendance');XLSX.writeFile(wb,'Attendance_One_Time_Upload_Format.xlsx');}
        // ================= APPROVAL ATTENDENCE & TASK CENTER =================
        let approvalCenterItems = [];
        let globalPendingWorkLogs = [];
        function approvalCenterDateKey(v){ const s=String(v||'').trim(); if(!s)return ''; const m=s.match(/(20\d{2})-(\d{2})-(\d{2})/); return m?m[0]:s.slice(0,10); }
        function approvalCenterInRange(date, month, from, to){
            const d=approvalCenterDateKey(date); if(!d)return !month&&!from&&!to;
            if(month && d.slice(0,7)!==month)return false;
            if(from && d<from)return false;
            if(to && d>to)return false;
            return true;
        }
        function approvalCenterRoleAllowed(){
            const role=String(document.getElementById('displayRole')?.innerText||'').toLowerCase();
            return role.includes('admin')||role.includes('hod')||role.includes('master');
        }
        function buildApprovalCenterItems(){
            const out=[];
            // Direct employee attendance records (Punch In/Out) are approval items too.
            (globalTeamAttendance||[]).forEach(r=>{
                const status=String(r.status||'Pending');
                if(!r.employee)return;
                const meta=attendanceMetaForUser(r.employee)||{};
                out.push({key:'attendance-record|'+r.rowIndex,type:'attendance',typeLabel:'Attendance',employee:r.user||r.employee||'',employeeId:meta.employeeId||r.employeeId||'',task:'Attendance',date:r.date||'',details:`In: ${r.inTime||'-'} • Out: ${r.outTime||'-'} • ${r.reason||'-'}`,status:status,rowIndex:r.rowIndex,action:'attendanceRecord',targetUser:r.user||r.employee||''});
            });
            (globalAttendanceRequests||[]).forEach(r=>{
                const status=String(r.status||'Pending');
                out.push({key:'attendance|'+r.rowIndex,type:'attendance',typeLabel:'Attendance',employee:r.employee||'',employeeId:r.employeeId||'',task:'Attendance Request',date:r.date||'',details:r.reason||'-',status:status,rowIndex:r.rowIndex,action:'attendance'});
            });
            (globalAdvanceScheduleRequests||[]).forEach(r=>{
                const status=String(r.status||'Pending'), rt=String(r.requestType||'');
                if(rt==='Emergency Task'){
                    out.push({key:'urgent|'+r.rowIndex,type:'task',typeLabel:'Task',employee:r.employee||'',employeeId:r.employeeId||'',task:r.taskName||'Today Urgent Task',date:r.requestDate||'',details:(r.category?r.category+' • ':'')+(r.assignBy?'Assign By: '+r.assignBy+' • ':'')+(r.details||'-'),status:status,rowIndex:r.rowIndex,action:'scheduleEmergency',requestId:r.requestId||'',assignBy:r.assignBy||'',approvalOwner:r.approvalOwner||''});
                    return;
                }
                const kind=rt.toLowerCase().includes('leave')?'leave':rt.toLowerCase().includes('weekoff')||rt.toLowerCase().includes('adjust')?'adjustment':'adjustment';
                out.push({key:'schedule|'+r.rowIndex,type:kind,typeLabel:kind==='leave'?'Leave':'Adjustment',employee:r.employee||'',employeeId:r.employeeId||'',task:rt||'Schedule Request',date:r.requestDate||'',details:r.details||r.location||'-',status:status,rowIndex:r.rowIndex,action:'schedule'});
            });
            // Daily Work logs do NOT require HOD/Admin approval.
            // Their minutes are accumulated directly into the task time spent.
            // Keep globalPendingWorkLogs available for reports/follow-up, but never
            // create approval-center items from them.
            (globalAllTasks||[]).forEach(t=>{
                const empStatus=String(t.empStatus||'').toLowerCase(), hodStatus=String(t.hodStatus||'').toLowerCase();
                const meta=attendanceMetaForUser(t.assignedTo||t.employee||'')||{};
                if(empStatus==='completion requested') out.push({key:'task-completion|'+(t.taskId||t.rowIndex),type:'task',typeLabel:'Task',employee:t.assignedTo||t.employee||'',employeeId:meta.employeeId||'',task:t.taskName||'Task',date:t.endDate||t.startDate||'',details:'Final Before/Completion approval required — separate from Daily Work approval',status:t.empStatus||'Completion Requested',rowIndex:t.rowIndex,taskId:t.taskId||'',action:'taskCompletion',targetUser:t.assignedTo||t.employee||'',approvalOwner:t.approvalOwner||''});
                else if(String(t.assignedBy||'').trim() && ['pending','approved','rejected'].includes(hodStatus)) out.push({key:'task-approval|'+(t.taskId||t.rowIndex),type:'task',typeLabel:'Task',employee:t.assignedTo||t.employee||'',employeeId:meta.employeeId||'',task:t.taskName||'Task',date:t.startDate||'',details:'Task approval',status:t.hodStatus||'Pending',rowIndex:t.rowIndex,taskId:t.taskId||'',action:'taskApproval',targetUser:t.assignedTo||t.employee||'',approvalOwner:t.approvalOwner||''});
            });
            return out;
        }
        function approvalCenterStatusMatches(x,status){const s=String(x.status||'').toLowerCase();return status==='all'||s===status||(status==='pending'&&s==='pending approval');}
        function openApprovalAttendanceTaskModal(){
            if(!approvalCenterRoleAllowed()){alert('Sirf HOD/Admin/MasterAdmin approval center open kar sakte hain.');return;}
            const modal=document.getElementById('approvalAttendanceTaskModal'); if(!modal)return;
            const empSel=document.getElementById('approvalCenterEmployee');
            if(empSel){const names=Array.from(new Set(approvalCenterItems.map(x=>x.employee).filter(Boolean))).sort();empSel.innerHTML='<option value="">All Employees</option>'+names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');}
            document.getElementById('approvalCenterType').value='all'; document.getElementById('approvalCenterStatus').value='pending'; document.getElementById('approvalCenterTask').value=''; document.getElementById('approvalCenterMonth').value=''; document.getElementById('approvalCenterFrom').value=''; document.getElementById('approvalCenterTo').value='';
            modal.style.display='block'; loadApprovalAttendanceTaskCenter();
        }
        function closeApprovalAttendanceTaskModal(){const m=document.getElementById('approvalAttendanceTaskModal');if(m)m.style.display='none';}
        let approvalCenterSyncInProgress=false;
        function fetchApprovalCenterData(forceRender=true){
            if(!sessionToken||approvalCenterSyncInProgress)return;
            approvalCenterSyncInProgress=true;
            const fd=new FormData();fd.append('action','getApprovalCenterData');fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{
                if(d.status!=='success')throw new Error(d.message||'Approval data load failed.');
                globalAllTasks=Array.isArray(d.tasks)?d.tasks:globalAllTasks;
                globalTeamAttendance=Array.isArray(d.teamAttendance)?d.teamAttendance:globalTeamAttendance;
                globalAdvanceScheduleRequests=Array.isArray(d.advanceScheduleRequests)?d.advanceScheduleRequests:globalAdvanceScheduleRequests;
                globalAttendanceRequests=Array.isArray(d.attendanceRequests)?d.attendanceRequests:globalAttendanceRequests;
                globalTeamMembers=Array.isArray(d.teamMembers)?d.teamMembers:globalTeamMembers;
                globalTeamMemberMeta=Array.isArray(d.teamMemberMeta)?d.teamMemberMeta:globalTeamMemberMeta;
                globalPendingWorkLogs=Array.isArray(d.pendingWorkLogs)?d.pendingWorkLogs:[];
                // Legacy backend may still return pendingWorkLogs. They are intentionally
                // not approval items in V38; attendance and task completion remain.
                approvalCenterItems=buildApprovalCenterItems();
                if(forceRender)renderApprovalAttendanceTaskCenter();
            }).catch(()=>{}).finally(()=>{approvalCenterSyncInProgress=false;});
        }
        function loadApprovalAttendanceTaskCenter(){
            fetchApprovalCenterData(true);
            approvalCenterItems=buildApprovalCenterItems();
            const empSel=document.getElementById('approvalCenterEmployee'); if(empSel){const current=empSel.value;const names=Array.from(new Set(approvalCenterItems.map(x=>x.employee).filter(Boolean))).sort();empSel.innerHTML='<option value="">All Employees</option>'+names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');if(names.includes(current))empSel.value=current;}
            renderApprovalAttendanceTaskCenter();
        }
        function renderApprovalAttendanceTaskCenter(){
            const box=document.getElementById('approvalCenterBody'); if(!box)return;
            const type=document.getElementById('approvalCenterType')?.value||'all', statusFilter=document.getElementById('approvalCenterStatus')?.value||'pending', emp=(document.getElementById('approvalCenterEmployee')?.value||'').toLowerCase(), task=(document.getElementById('approvalCenterTask')?.value||'').toLowerCase().trim(), month=document.getElementById('approvalCenterMonth')?.value||'', from=document.getElementById('approvalCenterFrom')?.value||'', to=document.getElementById('approvalCenterTo')?.value||'';
            const list=approvalCenterItems.filter(x=>(type==='all'||x.type===type)&&approvalCenterStatusMatches(x,statusFilter)&&(!emp||String(x.employee).toLowerCase()===emp)&&(!task||String(x.task).toLowerCase().includes(task))&&approvalCenterInRange(x.date,month,from,to));
            const count=document.getElementById('approvalCenterCount');if(count)count.textContent=list.length;
            if(!list.length){box.innerHTML='<tr><td colspan="8" class="p-8 text-center text-gray-500">No approval item found.</td></tr>';return;}
            box.innerHTML=list.map(x=>{
                const pending=String(x.status||'').toLowerCase()==='pending';
                const checkbox=pending?`<input type="checkbox" class="approval-center-check" data-key="${escapeHtml(x.key)}">`:'<span class="text-gray-300">—</span>';
                const action=pending?`<div class="flex gap-1"><button onclick="approvalCenterSingleAction('${escapeHtml(x.key)}','Approved')" class="bg-[#259b94] text-white px-3 py-1.5 rounded text-xs font-bold">Approve</button><button onclick="approvalCenterSingleAction('${escapeHtml(x.key)}','Rejected')" class="bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold">Reject</button></div>`:`<span class="text-xs font-bold ${String(x.status).toLowerCase()==='approved'?'text-green-600':'text-red-500'}">${escapeHtml(x.status)}</span>`;
                const statusClass=String(x.status).toLowerCase()==='approved'?'text-green-600':String(x.status).toLowerCase()==='rejected'?'text-red-500':'text-orange-600';
                return `<tr class="border-t hover:bg-gray-50"><td class="p-3">${checkbox}</td><td class="p-3"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${x.type==='task'?'bg-blue-50 text-blue-700':x.type==='worklog'?'bg-orange-50 text-orange-700':x.type==='leave'?'bg-amber-50 text-amber-700':'bg-purple-50 text-purple-700'}">${escapeHtml(x.typeLabel)}</span></td><td class="p-3 font-bold text-[#112a2e]">${escapeHtml(x.employee)}${x.employeeId?`<div class="text-[10px] text-gray-500 font-semibold">ID: ${escapeHtml(x.employeeId)}</div>`:''}</td><td class="p-3 font-semibold">${escapeHtml(x.task)}</td><td class="p-3">${escapeHtml(x.date||'-')}</td><td class="p-3 text-xs text-gray-600 max-w-[320px] whitespace-normal">${escapeHtml(x.details||'-')}</td><td class="p-3 text-xs font-bold ${statusClass}">${escapeHtml(x.status)}</td><td class="p-3">${action}</td></tr>`;
            }).join('');
        }
        function toggleApprovalCenterSelectAll(checked){document.querySelectorAll('#approvalCenterBody .approval-center-check').forEach(c=>c.checked=!!checked);const h=document.getElementById('approvalCenterSelectAll');if(h)h.checked=!!checked;}
        function approvalCenterFind(key){return approvalCenterItems.find(x=>x.key===key)||null;}
        let approvalRejectContext = null;
        function openApprovalRejectModal(key){
            const item=approvalCenterFind(key); if(!item)return;
            approvalRejectContext={mode:'single',items:[item]};
            const title=document.getElementById('approvalRejectTitle'), taskBox=document.getElementById('taskRejectReasonBox'), attBox=document.getElementById('attendanceRejectReasonBox'), otherBox=document.getElementById('taskRejectOtherBox');
            if(title)title.textContent=item.type==='attendance'?'Attendance Reject Reason':(item.type==='worklog'?'Daily Work Reject Reason':'Task Reject Reason');
            if(taskBox)taskBox.style.display=(item.type==='task'||item.type==='worklog')?'block':'none'; if(attBox)attBox.style.display=item.type==='attendance'?'block':'none'; if(otherBox)otherBox.style.display='none';
            const tr=document.getElementById('taskRejectReason');if(tr)tr.value=''; const ar=document.getElementById('attendanceRejectReason');if(ar)ar.value=''; const ot=document.getElementById('taskRejectReasonOther');if(ot)ot.value='';
            document.getElementById('approvalRejectModal').style.display='block';
        }
        function closeApprovalRejectModal(){const m=document.getElementById('approvalRejectModal');if(m)m.style.display='none';approvalRejectContext=null;}
        function toggleTaskRejectOther(){const v=document.getElementById('taskRejectReason')?.value;const b=document.getElementById('taskRejectOtherBox');if(b)b.style.display=v==='Other'?'block':'none';}
        function approvalCenterPost(item,status,rejectionReason='',rejectionReasonOther='',extra={}){
            const fd=new FormData();fd.append('sessionToken',sessionToken);
            if(item.action==='workLogApproval'){fd.append('action','reviewWorkLog');fd.append('targetUser',item.targetUser||item.employee||'');fd.append('rowIndex',item.rowIndex);fd.append('status',status);if(rejectionReason)fd.append('rejectionReason',rejectionReason);}
            else if(item.action==='attendance'){fd.append('action','reviewAttendanceRequest');fd.append('rowIndex',item.rowIndex);fd.append('status',status);if(rejectionReason)fd.append('rejectionReason',rejectionReason);}
            else if(item.action==='attendanceRecord'){fd.append('action','reviewAttendanceRecord');fd.append('targetUser',item.targetUser||item.employee||'');fd.append('rowIndex',item.rowIndex);fd.append('status',status);if(rejectionReason)fd.append('rejectionReason',rejectionReason);}
            else if(item.action==='schedule' || item.action==='scheduleEmergency'){fd.append('action','updateAdvanceScheduleRequest');fd.append('rowIndex',item.rowIndex);fd.append('status',status);if(item.action==='scheduleEmergency' && extra.durationDays)fd.append('durationDays',String(extra.durationDays));}
            else {fd.append('action','updateTaskStatus');fd.append('targetUser',item.targetUser||'');fd.append('rowIndex',item.rowIndex);fd.append('type','hod');fd.append('status',status);if(rejectionReason)fd.append('rejectionReason',rejectionReason);if(rejectionReasonOther)fd.append('rejectionReasonOther',rejectionReasonOther);}
            return fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json());
        }
        function submitApprovalReject(){
            const ctx=approvalRejectContext;if(!ctx||!ctx.items.length)return;
            const item=ctx.items[0]; let reason='',other='';
            if(item.type==='attendance'){reason=document.getElementById('attendanceRejectReason')?.value||'';if(!reason){alert('Attendance reject reason select karein.');return;}}
            else if(item.type==='task'||item.type==='worklog'){reason=document.getElementById('taskRejectReason')?.value||'';if(!reason){alert('Task reject reason select karein.');return;}if(reason==='Other'){other=(document.getElementById('taskRejectReasonOther')?.value||'').trim();if(!other){alert('Other reason likhiye.');return;}}}
            const btn=document.getElementById('approvalRejectSubmit');if(btn)btn.disabled=true;
            Promise.all(ctx.items.map(x=>approvalCenterPost(x,'Rejected',reason,other))).then(ds=>{const bad=ds.filter(d=>d.status!=='success');if(bad.length){const msgs=bad.map(d=>d&&d.message).filter(Boolean);alert(msgs.length?msgs.join('\n'):'Rejection update failed.');}else alert('Rejected successfully. Employee ko notification bhej di gayi hai.');closeApprovalRejectModal();fetchDashboardDataSilently();fetchServerNotifications();setTimeout(loadApprovalAttendanceTaskCenter,300);}).catch(()=>alert('Rejection update failed.')).finally(()=>{if(btn)btn.disabled=false;});
        }
        let urgentTaskApprovalContext=null;
        function openUrgentTaskApprovalModal(key){
            const item=approvalCenterFind(key); if(!item)return;
            urgentTaskApprovalContext=item;
            const info=document.getElementById('urgentTaskApprovalInfo');if(info)info.innerHTML=`<b>${escapeHtml(item.employee||'Employee')}</b> • ${escapeHtml(item.task||'Today Urgent Task')}<br><span class="text-xs">Assign By: ${escapeHtml(item.assignBy||'-')}</span>`;
            const days=document.getElementById('urgentTaskApprovalDays');if(days)days.value='1';
            const m=document.getElementById('urgentTaskApprovalModal');if(m)m.style.display='block';
        }
        function closeUrgentTaskApprovalModal(){const m=document.getElementById('urgentTaskApprovalModal');if(m)m.style.display='none';urgentTaskApprovalContext=null;}
        function approvalCenterSingleAction(key,status){
            const item=approvalCenterFind(key);if(!item)return;
            if(status==='Rejected'){openApprovalRejectModal(key);return;}
            if(item.action==='scheduleEmergency'){openUrgentTaskApprovalModal(key);return;}
            const row=document.querySelector(`#approvalCenterBody .approval-center-check[data-key=\"${CSS.escape(String(key))}\"]`)?.closest('tr');
            const btn=row?.querySelector('button'); if(btn){btn.disabled=true;btn.textContent='Saving...';}
            if(row)row.remove();
            approvalCenterPost(item,status).then(d=>{
                if(d.status==='success'){fetchDashboardDataSilently();fetchServerNotifications();setTimeout(loadApprovalAttendanceTaskCenter,200);}
                else{alert(d.message||'Approval update failed.');loadApprovalAttendanceTaskCenter();}
            }).catch(()=>{alert('Approval update failed.');loadApprovalAttendanceTaskCenter();});
        }
        async function bulkApprovalCenterAction(status){
            const keys=Array.from(document.querySelectorAll('#approvalCenterBody .approval-center-check:checked')).map(c=>c.dataset.key);if(!keys.length){alert('Pehle approval items select karein.');return;}
            const items=keys.map(approvalCenterFind).filter(Boolean);
            if(status==='Rejected'){
                const types=new Set(items.map(x=>x.type)); if(types.size>1){alert('Bulk Reject mein ek hi type (Task ya Attendance) select karein.');return;}
                approvalRejectContext={mode:'bulk',items:items}; const first=items[0]; document.getElementById('approvalRejectTitle').textContent=first.type==='attendance'?'Attendance Reject Reason':(first.type==='worklog'?'Daily Work Reject Reason':'Task Reject Reason'); document.getElementById('taskRejectReasonBox').style.display=first.type==='task'?'block':'none'; document.getElementById('attendanceRejectReasonBox').style.display=first.type==='attendance'?'block':'none'; document.getElementById('taskRejectOtherBox').style.display='none'; document.getElementById('taskRejectReason').value=''; document.getElementById('attendanceRejectReason').value=''; document.getElementById('taskRejectReasonOther').value=''; document.getElementById('approvalRejectModal').style.display='block'; return;
            }
            if(items.some(x=>x.action==='scheduleEmergency')){alert('Today Urgent Task ko individual Approve karein, kyunki approval ke waqt Working Days select karne honge.');return;}
            if(!confirm(`${items.length} item(s) ko Approve karna hai?`))return;
            const buttons=document.querySelectorAll('#approvalCenterBody .approval-center-check:checked'); buttons.forEach(c=>{const b=c.closest('tr')?.querySelector('button');if(b){b.disabled=true;b.textContent='Saving...';} c.closest('tr')?.remove();});
            const results=await Promise.all(items.map(item=>approvalCenterPost(item,status).catch(()=>({status:'error'}))));
            const fail=results.filter(d=>d.status!=='success').length;
            if(fail){alert(`${items.length-fail} approved successfully. ${fail} item(s) failed.`);}
            fetchDashboardDataSilently();fetchServerNotifications();setTimeout(loadApprovalAttendanceTaskCenter,200);
        }

        function openAttendanceExcelModal(){document.getElementById('attendanceExcelFile').value='';document.getElementById('attendanceExcelPreview').innerHTML='';document.getElementById('attendanceExcelModal').style.display='block';}
        function closeAttendanceExcelModal(){document.getElementById('attendanceExcelModal').style.display='none';}
        function uploadAttendanceExcelOnce(){const f=document.getElementById('attendanceExcelFile').files[0];if(!f){alert('Excel file select karein.');return;}const rd=new FileReader();rd.onload=function(ev){try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],arr=XLSX.utils.sheet_to_json(ws,{defval:''});if(!arr.length){alert('Excel mein data nahi hai.');return;}const excelDate=v=>{if(v instanceof Date)return v.toISOString().split('T')[0];if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}return String(v||'').trim();}; const excelTime=v=>{if(v instanceof Date)return v.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});if(typeof v==='number'&&v>=0&&v<1){const total=Math.round(v*86400),h=Math.floor(total/3600)%24,m=Math.floor((total%3600)/60),sec=total%60,ap=h>=12?'PM':'AM',hh=h%12||12;return `${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')} ${ap}`;}return String(v||'').trim();}; const rows=arr.map(r=>({date:excelDate(r['Date']||r['date']),employee:r['Employee ID']||r['Employee']||r['Username']||r['username'],inTime:excelTime(r['In Time']||r['InTime']),outTime:excelTime(r['Out Time']||r['OutTime']),breakStart:excelTime(r['Break Start']),breakEnd:excelTime(r['Break End']),leave:r['Leave/Weekoff']||r['Leave']||'',reason:r['Reason']||'',status:r['Approval Status']||'Approved'}));document.getElementById('attendanceExcelPreview').innerHTML=`<div class="bg-green-50 border border-green-200 rounded-lg p-3 font-semibold">${rows.length} row(s) ready for one-time import.</div>`;const fd=new FormData();fd.append('action','bulkAttendanceUpload');fd.append('rowsJson',JSON.stringify(rows));fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Import completed');if(d.failed&&d.failed.length)alert(d.failed.join('\n'));if(d.status==='success'){document.getElementById('attendanceExcelFile').value='';closeAttendanceExcelModal();fetchDashboardDataSilently();}}).catch(()=>alert('Excel upload failed.'));}catch(e){alert('Excel format read nahi ho saka: '+e.message);}};rd.readAsArrayBuffer(f);}
        function openAttendanceRequestsModal(){const box=document.getElementById('attendanceRequestsList'),reqs=globalAttendanceRequests||[];if(!box)return; if(!reqs.length){box.innerHTML='<div class="p-6 text-center text-gray-500">No attendance requests.</div>';}else box.innerHTML=reqs.map(r=>{const pending=String(r.status).toLowerCase()==='pending',manager=(document.getElementById('displayRole')?.innerText||'').toLowerCase().includes('admin')||(document.getElementById('displayRole')?.innerText||'').toLowerCase().includes('hod');return `<div class="border rounded-xl p-4 ${pending?'bg-[#fffbeb]':'bg-white'}"><div class="flex justify-between gap-2"><b>${r.employee}</b><span class="text-xs font-bold">${r.status}</span></div><div class="text-sm mt-2">Date: <b>${r.date}</b><br>Reason: ${r.reason||'-'}<br><span class="text-xs text-gray-500">Submitted: ${r.submittedAt||'-'}</span></div>${pending&&manager?`<div class="mt-3 flex gap-2"><button onclick="reviewAttendanceRequest(${r.rowIndex},'Approved')" class="bg-[#259b94] text-white px-4 py-2 rounded-lg text-xs font-bold">Approve & Add Attendance</button><button onclick="reviewAttendanceRequest(${r.rowIndex},'Rejected')" class="bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold">Reject</button></div>`:''}</div>`}).join('');document.getElementById('attendanceRequestsModal').style.display='block';}
        function closeAttendanceRequestsModal(){document.getElementById('attendanceRequestsModal').style.display='none';}
        function reviewAttendanceRequest(rowIndex,status){const fd=new FormData();fd.append('action','reviewAttendanceRequest');fd.append('rowIndex',rowIndex);fd.append('status',status);fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Updated');if(d.status==='success'){openAttendanceRequestsModal();fetchDashboardDataSilently();}}).catch(()=>alert('Request update failed.'));}

        // ================= NOTIFICATIONS =================
        function closeNotifications(){const p=document.getElementById('notificationPanel');if(p)p.classList.add('hidden');}
        function notificationStorageKey(){const u=(window.currentUser&&window.currentUser.username)||(document.getElementById('displayName')?.innerText||'user');return 'office_task_reporting_notifications_read_'+String(u).trim().toLowerCase();}
        function getReadNotificationIds(){try{return JSON.parse(localStorage.getItem(notificationStorageKey())||'[]');}catch(e){return [];}}
        function setReadNotificationIds(ids){try{localStorage.setItem(notificationStorageKey(),JSON.stringify(Array.from(new Set(ids)).slice(-300)));}catch(e){}}
        function getReadNotificationMeta(){try{return JSON.parse(localStorage.getItem(notificationStorageKey()+'_meta')||'{}');}catch(e){return {};}}
        function setReadNotificationMeta(meta){try{const keys=Object.keys(meta),keep=keys.slice(-300),out={};keep.forEach(k=>out[k]=meta[k]);localStorage.setItem(notificationStorageKey()+'_meta',JSON.stringify(out));}catch(e){}}
        function notificationId(n){return String(n.type||'')+'|'+String(n.key||n.title||'')+'|'+String(n.date||'')+'|'+String(n.text||'');}
        function parseNotificationDate(raw){
            if(raw===null||raw===undefined||raw==='')return null;
            if(raw instanceof Date)return isNaN(raw.getTime())?null:raw;
            const v=String(raw).trim();
            // Google Sheet/date-only values in this app are commonly DD-MM-YYYY.
            let m=v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
            if(m){
                const day=Number(m[1]),month=Number(m[2])-1,year=Number(m[3]),hh=Number(m[4]||0),mm=Number(m[5]||0),ss=Number(m[6]||0);
                const d=new Date(year,month,day,hh,mm,ss);
                if(d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day)return d;
            }
            // ISO timestamps are safe to parse normally.
            const d=new Date(v);
            return isNaN(d.getTime())?null:d;
        }
        function formatNotificationDate(raw){
            const d=parseNotificationDate(raw);
            if(!d)return raw?String(raw):'';
            return d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
        }
        function notificationTime(n){return formatNotificationDate(n.timestamp||n.date||'');}
        function markNotificationRead(id){
            const ids=getReadNotificationIds();
            const meta=getReadNotificationMeta();
            if(!ids.includes(id))ids.push(id);
            meta[id]=new Date().toISOString();
            setReadNotificationIds(ids);
            setReadNotificationMeta(meta);
            renderNotifications();
        }
        function markAllNotificationsRead(){
            const items=notificationItems(),now=new Date().toISOString(),meta=getReadNotificationMeta();
            items.forEach(n=>{meta[notificationId(n)]=now;});
            setReadNotificationIds(items.map(notificationId));
            setReadNotificationMeta(meta);
            renderNotifications();
        }
        function toggleNotifications(){const p=document.getElementById('notificationPanel');if(!p)return;p.classList.toggle('hidden');if(!p.classList.contains('hidden')){fetchServerNotifications();renderNotifications();}}
        function fetchServerNotifications(){if(!sessionToken)return;const fd=new FormData();fd.append('action','getServerNotifications');fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{if(d.status==='success'){window.serverNotifications=Array.isArray(d.notifications)?d.notifications:[];renderNotifications();}}).catch(()=>{});}
        function notificationItems(){
            const role=(document.getElementById('displayRole')?.innerText||'').toLowerCase(),items=[],tasks=globalAllTasks||[],atts=globalTeamAttendance||[],sched=globalAdvanceScheduleRequests||[],attReqs=globalAttendanceRequests||[],delayReports=window.globalDelayReports||[];
            (window.serverNotifications||[]).forEach(n=>{
                const title=String(n.title||''), action=String(n.action||'');
                // Daily Work minutes are auto-recorded; only Attendance and
                // Before/Complete Task actions require approval.
                if(/daily work.*approval|approval.*daily work/i.test(title+' '+String(n.text||''))) return;
                const approvalTitle=/approval required|today urgent task request/i.test(title);
                const employeeSchedule=/advance schedule request/i.test(title) && !approvalTitle;
                items.push({type:'server',key:n.id,title:n.title,text:n.text,action:(action==='approval-center'||approvalTitle)?'approval-center':(employeeSchedule?'schedule-form':action),date:n.timestamp,priority:n.priority});
            });
            if(role.includes('hod')||role.includes('admin')){
                tasks.forEach(t=>{if(String(t.hodStatus||'').toLowerCase()==='pending'&&['completed','completion requested'].includes(String(t.empStatus||'').toLowerCase()))items.push({type:'task',key:t.taskId||t.rowIndex,title:'Task approval required',text:`${t.taskName||'Task'} — ${t.assignedTo||''}`,action:'approval-center',date:t.completedAt||t.endDate||t.startDate});});
                atts.forEach(a=>{if(String(a.status||'').toLowerCase()==='pending')items.push({type:'attendance',key:a.rowIndex||a.date,title:'Attendance approval required',text:`${a.user||''} — ${a.date||''}`,action:'approval-center',date:a.date});});
                delayReports.slice(-20).forEach((r,i)=>items.push({type:'delay',key:(r.employee||'')+'|'+(r.task||'')+'|'+(r.date||'')+'|'+i,title:'Task Delay Report',text:`${r.employee||''} — ${r.task||''}: ${r.reason||''}`,action:'task',date:r.date||''}));
                sched.forEach(r=>{if(String(r.status||'').toLowerCase()==='pending')items.push({type:'schedule',key:r.requestId||r.rowIndex,title:'Advance Schedule Request',text:`${r.employee||''} — ${r.requestType||''} — ${r.requestDate||''}`,action:'approval-center',date:r.submittedAt||r.requestDate});});
                attReqs.forEach(r=>{if(String(r.status||'').toLowerCase()==='pending')items.push({type:'attendance-request',key:r.requestId||r.rowIndex,title:'Attendance Entry Request',text:`${r.employee||''} — ${r.date||''} — ${r.reason||''}`,action:'approval-center',date:r.submittedAt||r.date});});
            }else{
                attReqs.forEach(r=>{if(String(r.status||'').toLowerCase()==='approved')items.push({type:'attendance-request',key:r.requestId||r.rowIndex,title:'Attendance Request Approved',text:`${r.date||''} — ${r.reason||''}`,action:'attendance-request',date:r.reviewedAt||r.date});else if(String(r.status||'').toLowerCase()==='rejected')items.push({type:'attendance-request',key:r.requestId||r.rowIndex,title:'Attendance Request Rejected',text:`${r.date||''} — ${r.reason||''}`,action:'attendance-request',date:r.reviewedAt||r.date});});
                tasks.forEach(t=>{const s=String(t.hodStatus||'').toLowerCase();if(s==='approved')items.push({type:'task',key:t.taskId||t.rowIndex,title:'Task assigned / approved',text:`${t.taskName||'Task'} — ${t.assignedBy||''}`,action:'task',date:t.startDate});else if(s==='rejected')items.push({type:'task',key:t.taskId||t.rowIndex,title:'Task request rejected',text:t.taskName||'Task',action:'task',date:t.startDate});else if(String(t.empStatus||'').toLowerCase()==='completion requested')items.push({type:'task',key:t.taskId||t.rowIndex,title:'Early completion request pending',text:t.taskName||'Task',action:'task',date:t.endDate});else if(String(t.empStatus||'').toLowerCase()==='pending')items.push({type:'task',key:t.taskId||t.rowIndex,title:'New task assigned',text:`${t.taskName||'Task'} — ${t.assignedBy||''}`,action:'task',date:t.startDate});});
                const now=new Date();
                if(now.getDate()<=14){
                    const nm=now.getMonth()===11?0:now.getMonth()+1, ny=now.getMonth()===11?now.getFullYear()+1:now.getFullYear();
                    const hasNext=sched.some(r=>{const d=String(r.requestDate||'').split('-');return d.length===3 && Number(d[1])===nm+1 && Number(d[2])===ny && String(r.status||'').toLowerCase()!=='rejected';});
                    if(!hasNext)items.push({type:'schedule-reminder',key:`${ny}-${nm+1}`,title:'Advance Schedule Requests',text:`Aapka next month Advance Schedule abhi add nahi hua. ${15-now.getDate()} din baaqi hain.`,action:'schedule-form',date:now});
                }
            }
            return items.slice(0,50);
        }
        function renderNotifications(){
            const list=document.getElementById('notificationList'),count=document.getElementById('notificationCount'),label=document.getElementById('notificationUnreadLabel');if(!list||!count)return;
            const items=notificationItems(),readIds=getReadNotificationIds(),readMeta=getReadNotificationMeta();
            const unread=items.filter(n=>!readIds.includes(notificationId(n)));
            count.innerText=unread.length;count.classList.toggle('hidden',unread.length===0);count.classList.toggle('flex',unread.length>0);if(label)label.innerText=unread.length?`${unread.length} unread`:'All read';
            list.innerHTML='';
            if(!items.length){list.innerHTML='<div class="p-5 text-center text-sm text-gray-500">No notifications.</div>';return;}
            items.forEach(n=>{const id=notificationId(n),isRead=readIds.includes(id),row=document.createElement('button');row.type='button';row.className=`w-full text-left px-4 py-3 border-b transition ${isRead?'bg-white opacity-70 hover:bg-gray-50':'bg-[#f0fbf9] hover:bg-[#e7f7f4]'}`;const displayTime=isRead&&readMeta[id]?`Read ${formatNotificationDate(readMeta[id])}`:notificationTime(n);row.innerHTML=`<div class="flex items-start gap-2"><i class="fas fa-bell mt-1 ${isRead?'text-gray-400':'text-[#259b94]'}"></i><div class="min-w-0 flex-1"><div class="font-bold text-sm text-[#112a2e]">${n.title}${isRead?'':' <span class="ml-1 inline-block w-2 h-2 rounded-full bg-red-500 align-middle"></span>'}</div><div class="text-xs text-gray-600 mt-1">${n.text}</div><div class="text-[10px] text-gray-400 mt-1">${displayTime}</div></div></div>`;row.onclick=()=>{markNotificationRead(id);closeNotifications();if(n.action==='approval-center'){openApprovalAttendanceTaskModal();}else if(n.action==='task')openTaskReportModal();else if(n.action==='schedule-form'){openAdvanceScheduleModal();}else if(n.action==='schedule')openAdvanceScheduleApprovalModal();else if(n.action==='attendance-request')openAttendanceRequestsModal();else openOneViewModal();};list.appendChild(row);});
        }
        const refreshPositionObserver_=new MutationObserver(()=>{if(document.getElementById('dashboard-section')?.style.display==='flex')addRefreshButton_();});
        refreshPositionObserver_.observe(document.body,{childList:true,subtree:true});
        document.addEventListener('click',function(e){const b=document.getElementById('notificationBtn'),p=document.getElementById('notificationPanel');if(p&&!p.classList.contains('hidden')&&b&&!b.contains(e.target)&&!p.contains(e.target))closeNotifications();});
        setInterval(()=>{try{if(typeof renderNotifications==='function')renderNotifications();if(typeof fetchServerNotifications==='function'&&typeof approvalCenterRoleAllowed==='function'&&approvalCenterRoleAllowed())fetchServerNotifications();const m=document.getElementById('approvalAttendanceTaskModal');if(m&&m.style.display!=='none'&&typeof fetchApprovalCenterData==='function')fetchApprovalCenterData(true);}catch(e){}},3000);

        // ================= TASK REPORT =================

        function openSystemHealthModal(){document.getElementById('systemHealthModal').style.display='block';loadSystemHealth();}
        function closeSystemHealthModal(){document.getElementById('systemHealthModal').style.display='none';}
        function optimizeMasterSheets(){
            if(!confirm('Unused Master Sheet tabs ko remove karke sirf required sheets rakhi jayengi. Continue?')) return;
            const fd=new FormData();fd.append('action','optimizeMasterSheets');fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{alert(d.message||'Master Sheet optimize result');loadSystemHealth();}).catch(()=>alert('Sheet optimization failed.'));
        }

        function cleanupMasterSheetsNow(){
            if(!confirm('Google Sheet me sirf application ke required sheets rakhi jayengi. Users, Tasks aur Employee data safe rahega. Continue?')) return;
            const fd=new FormData();fd.append('action','cleanupMasterSheets');fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{alert(d.message||'Sheet cleanup complete.');loadSystemHealth();}).catch(()=>alert('Sheet cleanup failed.'));
        }

        function loadSystemHealth(){const box=document.getElementById('systemHealthBody');if(!box)return;box.innerHTML='<div class="p-5 text-center text-gray-500">Checking system...</div>';const fd=new FormData();fd.append('action','systemHealth');fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd,cache:'no-store'}).then(r=>r.json()).then(d=>{if(d.status!=='success'){box.innerHTML='<div class="p-4 bg-red-50 text-red-700 rounded-lg">'+(d.message||'Health check failed.')+'</div>';return;}box.innerHTML=(d.checks||[]).map(x=>'<div class="flex justify-between items-center border rounded-xl p-4 bg-white"><span class="font-bold">'+x.name+'</span><span class="font-bold '+(x.status==='OK'||x.status==='ACTIVE'||x.status==='READY'?'text-green-600':'text-amber-600')+'">'+x.status+'</span></div>').join('')+'<div class="mt-4 border rounded-xl p-4 bg-gray-50"><b>Recent System Errors:</b><div class="mt-2 text-xs text-gray-600">'+((d.errors||[]).map(e=>e.id+' — '+e.where+' — '+e.message).join('<br>')||'No recent errors.')+'</div></div>';}).catch(()=>{box.innerHTML='<div class="p-4 bg-red-50 text-red-700 rounded-lg">Health check connection failed.</div>';});}

        function openAuditLogModal(){document.getElementById('auditLogModal').style.display='block';loadAuditLog();}
        function closeAuditLogModal(){document.getElementById('auditLogModal').style.display='none';}
        function loadAuditLog(){const fd=new FormData();fd.append('action','getAuditLog');fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{if(d.status!=='success'){alert(d.message||'Audit Log load failed.');return;}const b=document.getElementById('auditLogBody');b.innerHTML=(d.records||[]).map(x=>`<tr class="border-t"><td class="p-3 text-xs">${x.timestamp||''}</td><td class="p-3 font-bold">${x.actor||''}</td><td class="p-3">${x.role||''}</td><td class="p-3 font-semibold">${x.action||''}</td><td class="p-3">${x.target||''}</td><td class="p-3 text-sm text-gray-600">${x.details||''}</td><td class="p-3 text-[9px] text-gray-400 break-all">${x.hash||''}</td></tr>`).join('')||'<tr><td colspan="7" class="p-6 text-center text-gray-500">No audit records.</td></tr>';}).catch(()=>alert('Audit Log load failed.'));}
        function openDelayAnalyticsModal(){document.getElementById('delayAnalyticsModal').style.display='block';loadDelayAnalytics();}
        function closeDelayAnalyticsModal(){document.getElementById('delayAnalyticsModal').style.display='none';}
        function loadDelayAnalytics(){const fd=new FormData();fd.append('action','getTaskDelayAnalytics');fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{if(d.status!=='success'){alert(d.message||'Delay Analytics load failed.');return;}document.getElementById('delayTotal').innerText=d.totalDelayedLogs||0;document.getElementById('delayTaskCount').innerText=(d.rows||[]).length;document.getElementById('delayAnalyticsBody').innerHTML=(d.rows||[]).map(x=>`<tr class="border-t"><td class="p-3 font-bold">${x.task||''}</td><td class="p-3 text-red-600 font-bold">${x.count||0}</td><td class="p-3">${x.minutes||0}</td><td class="p-3 text-sm text-gray-600">${x.topReason||'-'}</td></tr>`).join('')||'<tr><td colspan="4" class="p-6 text-center text-gray-500">No delayed task records.</td></tr>';}).catch(()=>alert('Delay Analytics load failed.'));}
        function runManualBackup(){if(!confirm('Master Sheet ka backup abhi create karein?'))return;const fd=new FormData();fd.append('action','runBackupNow');fd.append('sessionToken',sessionToken);fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>alert(d.message||'Backup complete.')).catch(()=>alert('Backup failed.'));}

        function openTaskReportModal() {
            document.getElementById('taskReportModal').style.display = 'block';
            const n=new Date(); document.getElementById('taskReportDate').valueAsDate=n; document.getElementById('taskReportMonth').value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; document.getElementById('taskReportYear').value=n.getFullYear();
            renderTaskReport(getReportTasks());
        }
        function toggleTaskReportFilters(){const v=document.getElementById('taskReportPeriod').value;['taskReportDateBox','taskReportMonthBox','taskReportYearBox'].forEach(id=>document.getElementById(id).classList.add('hidden'));if(v==='day'||v==='week')document.getElementById('taskReportDateBox').classList.remove('hidden');if(v==='month')document.getElementById('taskReportMonthBox').classList.remove('hidden');if(v==='year')document.getElementById('taskReportYearBox').classList.remove('hidden');}
        function filterTasksByReportPeriod(tasks){const v=document.getElementById('taskReportPeriod')?.value||'all';if(v==='all')return tasks;let start,end;if(v==='day'){const x=document.getElementById('taskReportDate').value;if(!x)return tasks;const [y,m,d]=x.split('-');start=new Date(+y,+m-1,+d);end=new Date(start);}
          else if(v==='week'){const x=document.getElementById('taskReportDate').value;if(!x)return tasks;const [y,m,d]=x.split('-');end=new Date(+y,+m-1,+d);start=new Date(end);start.setDate(start.getDate()-6);}
          else if(v==='month'){const x=document.getElementById('taskReportMonth').value;if(!x)return tasks;const [y,m]=x.split('-');start=new Date(+y,+m-1,1);end=new Date(+y,+m,0);}
          else {const y=Number(document.getElementById('taskReportYear').value);if(!y)return tasks;start=new Date(y,0,1);end=new Date(y,11,31);}
          return tasks.filter(t=>{const a=parseReportDate(t.startDate),b=parseReportDate(t.endDate);return a&&b&&b>=start&&a<=end;});}

        function closeTaskReportModal() { document.getElementById('taskReportModal').style.display = 'none'; }
        function getReportTasks() {
            const role = document.getElementById('displayRole').innerText;
            const isManager = isManagerRole(role);
            if(!isManager) return globalAllTasks || [];
            const filter = document.getElementById('hodEmpFilter').value;
            return filter && filter !== 'All' ? (globalAllTasks || []).filter(t => String(t.assignedTo).toLowerCase() === String(filter).toLowerCase()) : (globalAllTasks || []);
        }
        function parseReportDate(s) {
            if(!s || s === '-') return null;
            const p=String(s).split('-');
            if(p.length!==3) return null;
            const d=new Date(Number(p[2]),Number(p[1])-1,Number(p[0])); d.setHours(0,0,0,0); return d;
        }
        function taskDeadlineInfo(t) {
            const due=parseReportDate(t.endDate); if(!due) return {label:'-',className:'text-gray-500'};
            if(String(t.empStatus||'').toLowerCase()==='completed') {
                const done=parseReportDate(t.completedAt);
                if(done){ const n=Math.round((due-done)/86400000); if(n<0)return {label:`${n} Days (Delayed)`,className:'text-red-600'}; if(n===0)return {label:'0 Days (On Time)',className:'text-green-600'}; return {label:`+${n} Days (Early)`,className:'text-green-600'}; }
                return {label:'Done',className:'text-green-600'};
            }
            const today=new Date(); today.setHours(0,0,0,0); const n=Math.round((due-today)/86400000);
            if(n<0)return {label:`${n} Days (Delayed)`,className:'text-red-600'};
            if(n===0)return {label:'0 Days (Due Today)',className:'text-green-600'};
            return {label:`+${n} Days Left`,className:'text-green-600'};
        }
        function renderTaskReport(tasks) {
            tasks=filterTasksByReportPeriod(tasks);
            let on=0, delayed=0, pending=0, delayDays=0;
            tasks.forEach(t=>{const info=taskDeadlineInfo(t); if(String(t.empStatus).toLowerCase()==='completed' && info.label.indexOf('Delayed')>-1){delayed++;delayDays+=Math.abs(parseInt(info.label)||0);} else if(info.label.indexOf('Delayed')>-1){delayed++;delayDays+=Math.abs(parseInt(info.label)||0);} else if(String(t.empStatus).toLowerCase()!=='completed') pending++; else on++;});
            document.getElementById('trTotal').innerText=tasks.length;
            document.getElementById('trOnTime').innerText=on;
            document.getElementById('trDelayed').innerText=delayed;
            document.getElementById('trPending').innerText=pending;
            document.getElementById('trDelayDays').innerText=delayDays;
            const body=document.getElementById('taskReportBody'); body.innerHTML='';
            if(!tasks.length){body.innerHTML='<tr><td colspan="6" class="p-8 text-center text-gray-500 italic">No task data available.</td></tr>';return;}
            tasks.forEach(t=>{const info=taskDeadlineInfo(t);const status=String(t.empStatus||'').toLowerCase()==='completed'?'✅ Completed':'⏳ Pending';body.innerHTML+=`<tr class="border-t hover:bg-gray-50"><td class="p-3 font-bold">${t.taskName||'-'}${((document.getElementById('displayRole').innerText.indexOf('hod')>-1)||(document.getElementById('displayRole').innerText.indexOf('admin')>-1))?`<br><span class="text-xs text-[#259b94]">${t.assignedTo||''}</span>`:''}</td><td class="p-3 text-xs">${t.startDate||'-'}<br>to<br>${t.endDate||'-'}</td><td class="p-3 font-bold">${t.priority||'Normal'}</td><td class="p-3 font-bold">${t.timeSpent||0} mins</td><td class="p-3">${status}</td><td class="p-3 font-bold ${info.className}">${info.label}</td></tr>`;});
        }

        function savePerformanceWeightage(){
            const aw=Number(document.getElementById('progressReportAttWeight').value),tw=Number(document.getElementById('progressReportTaskWeight').value);
            if(!Number.isFinite(aw)||!Number.isFinite(tw)||aw<0||tw<0||Math.round(aw+tw)!==100){alert('Attendance + Task weightage must equal 100%.');return;}
            const fd=new FormData();fd.append('action','setPerformanceWeightage');fd.append('attendanceWeightage',aw);fd.append('taskWeightage',tw);fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{if(d.status!=='success'){alert(d.message||'Weightage save failed.');return;}performanceWeights=d.performanceWeights||{attendance:aw,task:tw};document.getElementById('attendanceWeightage').value=performanceWeights.attendance;document.getElementById('taskWeightage').value=performanceWeights.task;renderProgressReport();alert('Admin performance rule saved.');}).catch(()=>alert('Weightage save failed.'));
        }
        function followupDateKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
        function followupDateLabel(key){ const p=String(key).split('-'); if(p.length!==3)return key; return `${p[2]}-${p[1]}-${p[0]}`; }
        function followupIsWorkingDay(date, meta){
            const day=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()];
            if(String(meta?.weekoff||'Sunday').toLowerCase()===day.toLowerCase()) return false;
            return !(globalOfficeEvents||[]).some(ev=>String(followupDateKey(date))>=String(ev.fromDate||'')&&String(followupDateKey(date))<=String(ev.toDate||ev.fromDate||''));
        }
        function followupMissingDates(user,type){
            const meta=attendanceMetaForUser(user), today=new Date(); today.setHours(0,0,0,0), dates=[];
            for(let i=89;i>=0;i--){
                const d=new Date(today); d.setDate(today.getDate()-i);
                if(!followupIsWorkingDay(d,meta)) continue;
                const key=followupDateKey(d);
                const att=(globalMonthlyFullAttendance||[]).find(a=>String(a.Employee||'').toLowerCase()===String(user||'').toLowerCase()&&String(a.Date||'')===key);
                const hasAtt=!!(att&&att.InTime), hasLeave=!!(att&&String(att.Leave||'').toLowerCase().includes('leave'));
                const hasTask=(globalWorkLogs||[]).some(w=>String(w.Employee||'').toLowerCase()===String(user||'').toLowerCase()&&String(w.WorkDate||'')===key);
                const missingAtt=!hasAtt&&!hasLeave, missingTask=!hasTask;
                const pending=type==='attendance'?missingAtt:type==='task'?missingTask:(missingAtt||missingTask);
                if(pending) dates.push({key,missingAtt,missingTask});
            }
            return dates;
        }
        function setFollowupToday(){
            const k=followupDateKey(new Date());
            document.getElementById('followupFromDate').value=k; document.getElementById('followupToDate').value=k; buildFollowupMessage();
        }
        function setFollowupPendingRange(){
            const user=document.getElementById('followupEmployee')?.value||'', type=document.getElementById('followupType')?.value||'both', rows=followupMissingDates(user,type);
            if(!rows.length){ setFollowupToday(); return; }
            document.getElementById('followupFromDate').value=rows[0].key; document.getElementById('followupToDate').value=rows[rows.length-1].key; buildFollowupMessage();
        }
        async function openFollowupReminderModal(){
            const role=String(document.getElementById('displayRole')?.innerText||'').toLowerCase();if(!role.includes('admin'))return;
            document.getElementById('followupReminderModal').style.display='block';
            const sel=document.getElementById('followupEmployee');sel.innerHTML='';
            (globalTeamMembers||[]).forEach(e=>{sel.innerHTML+=`<option value="${progressReportEscape(e)}">${progressReportEscape(e)}</option>`;});
            if(!(globalWorkLogs||[]).length){ try{ await ensureWorkLogsLoaded(true); }catch(e){} }
            await loadFollowupDates();
        }
        function closeFollowupReminderModal(){document.getElementById('followupReminderModal').style.display='none';}
        function loadFollowupDates(){
            const user=document.getElementById('followupEmployee')?.value||'',type=document.getElementById('followupType')?.value||'both';
            const rows=followupMissingDates(user,type);
            if(rows.length){
                document.getElementById('followupFromDate').value=rows[0].key;
                document.getElementById('followupToDate').value=rows[rows.length-1].key;
            } else setFollowupToday();
            buildFollowupMessage();
        }
        function buildFollowupMessage(){
            const user=document.getElementById('followupEmployee')?.value||'Employee',type=document.getElementById('followupType')?.value||'both';
            const from=document.getElementById('followupFromDate')?.value||'',to=document.getElementById('followupToDate')?.value||'';
            if(!from||!to)return;
            const start=from<=to?from:to,end=from<=to?to:from;
            const dateText=`${followupDateLabel(start)} Se ${followupDateLabel(end)} Tak`;
            const now=new Date().toLocaleString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
            let body=`Salaam Pyare ${user},\n\n`;
            if(type==='attendance') body+=`Aap ki attendance ${dateText} Ki Attendance Aap Ne Update Nahi Ki Hai Jis Wajah Se Approval Pending Hai, Delay Karne Ka Reason Kya Hai Yeh Aap Bataye. On Time Attendance Update Karne Par Aap Ki Salary Sheet & Shoba Report Banne Men Ham Aazmaish Hogi Zarurat Ke Peshe Nazar Sharai Rahnumai Bhi Li Ja Sakti Hai. Bara E Karam On Time Attendance Ki Update Karne Ki Niyyat Farmalijiye. Allah Kareem Aap Ki Koshish Qabool Faramye.`;
            else if(type==='task') body+=`Aap ke work/task update ${dateText} Ke Task Ki Aap Ne Update Nahi Ki Hai Jis Wajah Se Approval Pending Hai, Delay Karne Ka Reason Kya Hai Yeh Aap Bataye. On Time Task Ki Update Karne Par Aap Ki Salary Sheet & Shoba Report Banne Men Ham Aazmaish Hogi Zarurat Ke Peshe Nazar Sharai Rahnumai Bhi Li Ja Sakti Hai. Bara E Karam On Time Task Ki Update Karne Ki Niyyat Farmalijiye. Allah Kareem Aap Ki Koshish Qabool Faramye.`;
            else body+=`Aap ki attendance aur work/task update ${dateText} Ki Attendance & Task Ki Aap Ne Update Nahi Ki Hai Jis Wajah Se Approval Pending Hai, Delay Karne Ka Reason Kya Hai Yeh Aap Bataye. On Time Attendance, Task Ki Update Karne Par Aap Ki Salary Sheet & Shoba Report Banne Men Ham Aazmaish Hogi Zarurat Ke Peshe Nazar Sharai Rahnumai Bhi Li Ja Sakti Hai. Bara E Karam On Time Attendance & Task Ki Update Karne Ki Niyyat Farmalijiye. Allah Kareem Aap Ki Koshish Qabool Faramye.`;
            body+=`\n\nAdmin Office\nGenerated: ${now}`;
            document.getElementById('followupMessage').value='FOLLOW-UP / REMINDER — ADMIN OFFICE\n\n'+body;
        }
        function buildTodayTaskReminder(){
            const user=document.getElementById('followupEmployee')?.value||'Employee';
            const today=followupDateKey(new Date());
            const tasks=(globalAllTasks||[]).filter(t=>String(t.assignedTo||'').toLowerCase()===String(user).toLowerCase()).filter(t=>{
                const s=progressReportDateObj(t.startDate),e=progressReportDateObj(t.endDate)||s, d=progressReportDateObj(today); if(!s||!d)return false;
                return s<=d&&(!e||e>=d)&&!['completed','approved'].includes(String(t.empStatus||t.status||'').toLowerCase());
            });
            const now=new Date().toLocaleString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
            let msg='TODAY TASK REMINDER — ADMIN OFFICE\n\nSalaam Pyare '+user+',\n\nAaj Ke Task Jo Aap Ko Assign Kiye Gaye Hai Isper Working Karna Zaruri Hai..\n\nAaj Ke Assigned Tasks Ki Details:\n';
            if(!tasks.length) msg+='\nAaj ke liye koi pending assigned task nahi mila.\n';
            else tasks.forEach((t,i)=>{msg+=`\n${i+1}. ${t.taskName||t.name||t.title||'Task'} | Category: ${t.category||'-'} | Priority: ${t.priority||'Normal'} | From: ${t.startDate||'-'} | To: ${t.endDate||'-'} | Status: ${t.empStatus||t.status||'Pending'}${t.assignedBy?' | Assigned By: '+t.assignedBy:''}`;if(t.works&&t.works.length)t.works.forEach((w,j)=>{msg+=`\n   ${String.fromCharCode(97+j)}. ${w.work||'-'} | ${w.category||'-'} | ${w.frequency||'Monthly'} | ${Number(w.weightage)||0}%`;});});
            msg+='\n\nBara E Karam In Tasks Par Aaj Hi Working Kar Lijiye Aur Update Kar Dijiye.\nShukriya.\n\nAdmin Office\nGenerated: '+now;
            document.getElementById('followupMessage').value=msg;
        }
        function sendFollowupReminder(){
            const user=document.getElementById('followupEmployee').value,msg=document.getElementById('followupMessage').value.trim(),from=document.getElementById('followupFromDate').value,to=document.getElementById('followupToDate').value;
            if(!user||!msg)return alert('Employee aur message required hai.');
            if(!from||!to)return alert('From Date aur To Date select karein.');
            const fd=new FormData();fd.append('action','sendFollowupReminder');fd.append('username',user);fd.append('message',msg);fd.append('pendingDate',from+' to '+to);fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Reminder result');if(d.status==='success')closeFollowupReminderModal();}).catch(()=>alert('Reminder send failed.'));
        }
        function sendTodayTaskReminder(){
            const user=document.getElementById('followupEmployee')?.value,msg=document.getElementById('followupMessage')?.value.trim();
            if(!user||!msg)return alert('Employee aur message required hai.');
            const fd=new FormData();fd.append('action','sendFollowupReminder');fd.append('username',user);fd.append('message',msg);fd.append('pendingDate',followupDateKey(new Date()));fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Today task reminder result');if(d.status==='success')closeFollowupReminderModal();}).catch(()=>alert('Today task reminder send failed.'));
        }
        function openOwnProfileModal(){document.getElementById('ownProfileModal').style.display='block';document.getElementById('ownOldPassword').value='';document.getElementById('ownNewPassword').value='';document.getElementById('ownConfirmPassword').value='';}
        function closeOwnProfileModal(){document.getElementById('ownProfileModal').style.display='none';}
        function changeOwnPassword(){
            const old=document.getElementById('ownOldPassword').value,a=document.getElementById('ownNewPassword').value,b=document.getElementById('ownConfirmPassword').value;
            if(!old)return alert('Old Password enter karein.');
            if(a.length<6)return alert('Password kam az kam 6 characters ka hona chahiye.');
            if(a!==b)return alert('New password aur confirm password same nahi hain.');
            const fd=new FormData();fd.append('action','changeOwnPassword');fd.append('oldPassword',old);fd.append('newPassword',a);fd.append('confirmPassword',b);fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Password update result');if(d.status==='success')location.reload();}).catch(()=>alert('Password change failed.'));
        }

        // ================= PROFESSIONAL PROGRESS REPORT =================
        let progressReportAttendanceChart = null, progressReportTaskChart = null;
        function closeProgressReportModal(){ document.getElementById('progressReportModal').style.display='none'; }
        function progressReportEscape(v){ return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
        function progressReportMonthKey(){ const v=document.getElementById('progressReportMonth')?.value||''; return v; }
        function progressReportDateObj(v){ const d=parseReportDate(v); return d; }
        function progressReportEmployees(){
            const role=String(document.getElementById('displayRole')?.innerText||'').toLowerCase();
            const all=Array.isArray(globalTeamMembers)?globalTeamMembers.slice():[];
            if(role.includes('admin')||role.includes('hod')) return all.length?all:[document.getElementById('displayUser')?.innerText||''];
            return [document.getElementById('displayUser')?.innerText||''];
        }
        function progressReportTasksFor(emp, start, end){
            return (globalAllTasks||[]).filter(t=>{
                if(String(t.assignedTo||'').toLowerCase()!==String(emp||'').toLowerCase()) return false;
                const s=progressReportDateObj(t.startDate), e=progressReportDateObj(t.endDate)||s;
                return s&&e&&e>=start&&s<=end;
            });
        }
        function progressReportAttendanceFor(emp, start, end){
            const seen=new Map();
            (globalMonthlyFullAttendance||[]).forEach(a=>{
                if(String(a.Employee||'').toLowerCase()!==String(emp||'').toLowerCase()) return;
                const d=progressReportDateObj(a.Date); if(!d||d<start||d>end)return;
                const key=d.getTime(); if(!seen.has(key)||(!seen.get(key).InTime&&a.InTime))seen.set(key,a);
            });
            return Array.from(seen.values()).sort((a,b)=>(progressReportDateObj(a.Date)||0)-(progressReportDateObj(b.Date)||0));
        }
        function progressReportEmployeeStats(emp,start,end){
            const rows=progressReportAttendanceFor(emp,start,end), tasks=progressReportTasksFor(emp,start,end);
            let present=0,absent=0,leave=0,weekoff=0,closed=0;
            rows.forEach(a=>{const l=String(a.Leave||'').toLowerCase(); if(l.includes('weekoff'))weekoff++; else if(l.includes('leave'))leave++; else if(l.includes('office closed')||l.includes('event'))closed++; else if(a.InTime)present++; else absent++;});
            const working=Math.max(0,rows.length-weekoff-leave-closed), attendancePct=working?Math.round((present/working)*100):0;
            const completed=tasks.filter(t=>String(t.empStatus||'').toLowerCase()==='completed').length;
            const taskPct=tasks.length?Math.round(completed/tasks.length*100):0;
            const aw=Number(performanceWeights.attendance)||50,tw=Number(performanceWeights.task)||50;
            const overall=Math.round((attendancePct*aw+taskPct*tw)/100);
            const meta=attendanceMetaForUser(emp);
            const rowEmployeeId=rows.find(r=>r.EmployeeId)?.EmployeeId||''; return {emp,rows,tasks,present,absent,leave,weekoff,closed,working,attendancePct,completed,taskPct,overall,department:meta.department||'',employeeId:meta.employeeId||rowEmployeeId||''};
        }
        function openEmployeeProgressDirect(emp){
            const modal=document.getElementById('progressReportModal');
            if(modal && modal.style.display!=='block') openProgressReportModal();
            const sel=document.getElementById('progressReportEmployee');
            if(sel){
                const match=Array.from(sel.options).find(o=>String(o.value).toLowerCase()===String(emp).toLowerCase());
                if(match) sel.value=match.value;
            }
            renderProgressReport();
            setTimeout(()=>document.getElementById('progressReportDetails')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
        }
        function progressReportRange(){
            const raw=progressReportMonthKey(), p=raw.split('-');
            if(p.length!==2)return null;
            return {start:new Date(+p[0],+p[1]-1,1),end:new Date(+p[0],+p[1],0)};
        }
        function progressReportBuildChart(canvasId, labels, values, label, type, pieLabels){
            const ctx=document.getElementById(canvasId)?.getContext('2d'); if(!ctx)return null;
            const old=type==='attendance'?progressReportAttendanceChart:progressReportTaskChart; if(old)old.destroy();
            const sliceLabels=Array.isArray(pieLabels)&&pieLabels.length?pieLabels:labels;
            const inst=new Chart(ctx,{
                type:'pie',
                data:{labels:sliceLabels,datasets:[{label,data:values,backgroundColor:['#259b94','#ef4444','#f59e0b','#3b82f6','#8b5cf6','#14b8a6'],borderColor:'#ffffff',borderWidth:2}]},
                options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'right',labels:{usePointStyle:true,padding:14}},tooltip:{callbacks:{label:(ctx)=>{const total=(ctx.dataset.data||[]).reduce((a,b)=>a+(Number(b)||0),0);const v=Number(ctx.raw)||0;const pct=total?Math.round(v/total*100):0;return `${ctx.label}: ${v} (${pct}%)`;}}}}} 
            });
            if(type==='attendance')progressReportAttendanceChart=inst; else progressReportTaskChart=inst; return inst;
        }
        function progressReportRenderDetails(stats){
            const box=document.getElementById('progressReportDetails'); if(!box)return;
            box.innerHTML=stats.map(s=>{
                const taskRows=s.tasks.slice().sort((a,b)=>(progressReportDateObj(a.endDate)||new Date(0))-(progressReportDateObj(b.endDate)||new Date(0))).map(t=>{const taskStatus=String(t.hodStatus||'').toLowerCase()==='approved'?'Approve':(String(t.empStatus||'').toLowerCase()==='completed'?'Pending':'Pending');return `<tr><td>${progressReportEscape(t.assignedBy||'-')}</td><td>${progressReportEscape(t.taskName||'-')}</td><td>${progressReportEscape(t.startDate||'-')} → ${progressReportEscape(t.endDate||'-')}</td><td>${progressReportEscape(t.priority||'Normal')}</td><td>${progressReportEscape(t.empStatus||'Pending')}</td><td>${Number(t.timeSpent)||0} min</td><td>${progressReportEscape(taskStatus)}</td></tr>`;}).join('')||'<tr><td colspan="7" class="p-4 text-center text-gray-500">No tasks found.</td></tr>';
                const parseProgressTimeMinutes=v=>{const s=String(v||'').trim(); if(!s)return null; const m=s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i); if(!m)return null; let h=Number(m[1]),mi=Number(m[2]); const ap=(m[3]||'').toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0; return h*60+mi;}; const progressTotalWorkingMinutes=a=>{const st=parseProgressTimeMinutes(a.InTime),en=parseProgressTimeMinutes(a.OutTime); if(st===null||en===null)return '-'; let total=en-st; if(total<0)total+=1440; const extra=Number(a.ExtraBreakMinutes)||0; return Math.max(0,Math.round(total-extra));}; const attRows=s.rows.map(a=>{const st=String(a.Status||'').trim();const statusLabel=st?st:(a.InTime?'Pending':'-');const actionLabel=String(st).toLowerCase()==='approved'?'Approve':(a.InTime?'Pending':'-');return `<tr><td>${progressReportEscape(a.Date||'-')}</td><td>${a.InTime||'-'}</td><td>${a.OutTime||'-'}</td><td>${progressReportEscape(statusLabel)}</td><td>${progressReportEscape(a.ExtraBreakMinutes ? (a.ExtraBreakMinutes+' min') : '-')}</td><td>${progressReportEscape(a.BreakTimeForIjara||'-')}</td><td>${progressReportEscape(a.Reason||'-')}</td><td>${progressTotalWorkingMinutes(a)==='-'?'-':progressTotalWorkingMinutes(a)+' min'}</td><td>${progressReportEscape(a.Location||'-')}</td><td>${progressReportEscape(actionLabel)}</td></tr>`;}).join('')||'<tr><td colspan="10" class="p-4 text-center text-gray-500">No attendance records found.</td></tr>';
                return `<div class="progress-report-section"><div class="flex flex-wrap justify-between items-center gap-2 mb-3"><div><h3 class="text-xl font-extrabold text-[#112a2e]">${progressReportEscape(s.emp)}${s.employeeId?` <span class=\"text-sm text-gray-500\">(${progressReportEscape(s.employeeId)})</span>`:''}</h3><div class="text-xs text-gray-500">Attendance ${s.attendancePct}% · Task ${s.taskPct}% · Overall ${s.overall}%</div></div><div class="text-sm font-bold text-[#259b94]">${s.completed}/${s.tasks.length} Tasks Complete</div></div><div class="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4"><div class="bg-[#f0f7f7] p-3 rounded-lg"><b>${s.present}</b><small class="block text-gray-500">Present</small></div><div class="bg-red-50 p-3 rounded-lg"><b>${s.absent}</b><small class="block text-gray-500">Absent</small></div><div class="bg-amber-50 p-3 rounded-lg"><b>${s.leave}</b><small class="block text-gray-500">Leave</small></div><div class="bg-blue-50 p-3 rounded-lg"><b>${s.weekoff}</b><small class="block text-gray-500">Weekoff</small></div><div class="bg-green-50 p-3 rounded-lg"><b>${s.completed}</b><small class="block text-gray-500">Completed</small></div><div class="bg-orange-50 p-3 rounded-lg"><b>${s.tasks.length-s.completed}</b><small class="block text-gray-500">Pending</small></div></div><div class="overflow-x-auto mb-4"><h4 class="font-bold mb-2">Attendance Details</h4><table class="progress-report-mini-table"><thead><tr><th>Date</th><th>In Time</th><th>Out Time</th><th>Status</th><th>Extra Break Time</th><th>Break Time For Ijara</th><th>Reason</th><th>Total Working Minutes</th><th>Location</th><th>Action</th></tr></thead><tbody>${attRows}</tbody></table></div><div class="overflow-x-auto"><h4 class="font-bold mb-2">Task Details</h4><table class="progress-report-mini-table"><thead><tr><th>Task Assign By</th><th>Task</th><th>Timeline</th><th>Priority</th><th>Status</th><th>Time</th><th>Action</th></tr></thead><tbody>${taskRows}</tbody></table></div></div>`;
            }).join('');
        }
        function renderProgressReport(){
            const range=progressReportRange(),err=document.getElementById('progressReportError'); if(!range){err.textContent='Please select Month & Year.';err.classList.remove('hidden');return;}
            const aw=Number(performanceWeights.attendance)||50,tw=Number(performanceWeights.task)||50; if(!Number.isFinite(aw)||!Number.isFinite(tw)||aw+tw!==100){err.textContent='Attendance + Task weightage must equal 100%.';err.classList.remove('hidden');return;} err.classList.add('hidden');
            const selected=document.getElementById('progressReportEmployee').value, emps=progressReportEmployees().filter(e=>!selected||selected==='__ALL__'||String(e).toLowerCase()===String(selected).toLowerCase());
            const stats=emps.map(e=>progressReportEmployeeStats(e,range.start,range.end));
            const totalTasks=stats.reduce((n,s)=>n+s.tasks.length,0),completed=stats.reduce((n,s)=>n+s.completed,0);
            const today=new Date(); today.setHours(0,0,0,0); const onTime=stats.filter(s=>s.rows.some(a=>{const d=progressReportDateObj(a.Date);return d&&d.getTime()===today.getTime()&&a.InTime;})).length;
            document.getElementById('prTotalEmployees').innerText=stats.length; document.getElementById('prOnTimeAvailable').innerText=onTime; document.getElementById('prTotalTasks').innerText=totalTasks; document.getElementById('prCompletedTasks').innerText=completed; document.getElementById('prTaskProgress').innerText=(totalTasks?Math.round(completed/totalTasks*100):0)+'%';
            const body=document.getElementById('progressReportEmployeeBody'); body.innerHTML=stats.map(s=>`<tr class="border-t progress-click-row" data-employee="${progressReportEscape(s.emp)}" onclick="openEmployeeProgressDirect(this.dataset.employee)" title="Open ${progressReportEscape(s.emp)} detailed report"><td class="p-3 font-bold"><div>${progressReportEscape(s.emp)}</div><div class="text-[10px] text-gray-500 font-semibold">${progressReportEscape(s.department||'Department not set')}${s.employeeId?' · '+progressReportEscape(s.employeeId):''}</div></td><td class="p-3 text-center">${s.attendancePct}%</td><td class="p-3 text-center text-green-600 font-bold">${s.present}</td><td class="p-3 text-center text-red-600">${s.absent}</td><td class="p-3 text-center text-amber-600">${s.leave}</td><td class="p-3 text-center text-blue-600">${s.weekoff}</td><td class="p-3 text-center">${s.tasks.length}</td><td class="p-3 text-center text-green-600 font-bold">${s.completed}</td><td class="p-3 text-center text-orange-600 font-bold">${s.taskPct}%</td><td class="p-3 text-center font-extrabold">${s.overall}%</td></tr>`).join('')||'<tr><td colspan="10" class="p-6 text-center text-gray-500">No report data.</td></tr>';
            const selectedEmployee=selected&&selected!=='__ALL__';
            let attendancePieLabels,attendancePieValues,taskPieLabels,taskPieValues;
            if(selectedEmployee && stats.length===1){
                const s=stats[0];
                attendancePieLabels=['Present','Absent','Leave','Weekoff','Office Closed'];
                attendancePieValues=[s.present,s.absent,s.leave,s.weekoff,s.closed];
                taskPieLabels=['Completed','Pending'];
                taskPieValues=[s.completed,Math.max(0,s.tasks.length-s.completed)];
            }else{
                attendancePieLabels=['Present','Absent','Leave','Weekoff','Office Closed'];
                attendancePieValues=[stats.reduce((n,s)=>n+s.present,0),stats.reduce((n,s)=>n+s.absent,0),stats.reduce((n,s)=>n+s.leave,0),stats.reduce((n,s)=>n+s.weekoff,0),stats.reduce((n,s)=>n+s.closed,0)];
                taskPieLabels=['Completed','Pending'];
                taskPieValues=[completed,Math.max(0,totalTasks-completed)];
            }
            progressReportBuildChart('progressReportAttendanceChart',attendancePieLabels,attendancePieValues,'Attendance','attendance',attendancePieLabels);
            progressReportBuildChart('progressReportTaskChart',taskPieLabels,taskPieValues,'Tasks','task',taskPieLabels);
            progressReportRenderDetails(stats);
            window.currentProgressReport={range,stats,aw,tw};
        }
        function openProgressReportModal(){
            document.getElementById('progressReportModal').style.display='block';
            const month=document.getElementById('progressReportMonth'), n=new Date(); month.value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
            const sel=document.getElementById('progressReportEmployee'), role=String(document.getElementById('displayRole')?.innerText||'').toLowerCase(); sel.innerHTML='';
            const emps=progressReportEmployees(); if(role.includes('admin')||role.includes('hod')) sel.innerHTML='<option value="__ALL__">All Employees</option>'+emps.map(e=>`<option value="${progressReportEscape(e)}">${progressReportEscape(e)}</option>`).join(''); else sel.innerHTML=emps.map(e=>`<option value="${progressReportEscape(e)}">${progressReportEscape(e)}</option>`).join('');
            document.getElementById('progressReportAttWeight').value=performanceWeights.attendance; document.getElementById('progressReportTaskWeight').value=performanceWeights.task; renderProgressReport();
        }
        async function loadJsPdfForProgressReport(){
            if(window.jspdf?.jsPDF)return true;
            return new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';sc.onload=()=>resolve(!!window.jspdf?.jsPDF);sc.onerror=reject;document.head.appendChild(sc);});
        }
        function progressReportCanvasData(labels,values,title){
            const c=document.createElement('canvas');c.width=1000;c.height=360;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#112a2e';x.font='bold 24px Arial';x.fillText(title,30,38);const max=100,base=305,chartH=230,barW=Math.max(24,Math.min(70,(c.width-80)/Math.max(labels.length,1)-16));labels.forEach((lab,i)=>{const v=Math.max(0,Math.min(max,Number(values[i])||0)),h=chartH*v/max,bx=55+i*((c.width-90)/Math.max(labels.length,1));x.fillStyle='#259b94';x.fillRect(bx,base-h,barW,h);x.fillStyle='#112a2e';x.font='bold 14px Arial';x.fillText(v+'%',bx,base-h-8);x.font='12px Arial';x.fillText(String(lab).slice(0,14),bx,base+18);});return c.toDataURL('image/png',1.0);}
        async function generateProgressReportPDF(){
            if(!window.currentProgressReport) renderProgressReport();
            const report=window.currentProgressReport;
            if(!report||!report.stats?.length){alert('Report data available nahi hai.');return;}
            try{
                const ok=await loadJsPdfForProgressReport(); if(!ok) throw new Error('PDF library load failed');
                const {jsPDF}=window.jspdf, doc=new jsPDF('l','mm','a4');
                const W=297,H=210,margin=10, generatedAt=new Date();
                const month=progressReportMonthKey(), generatedBy=document.getElementById('displayUser')?.innerText||'User';
                const generatedAtText=generatedAt.toLocaleString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
                const text=(v,max=60)=>String(v??'-').replace(/[\r\n]+/g,' ').slice(0,max);
                const header=(title,sub)=>{doc.setFillColor(17,42,46);doc.rect(0,0,W,24,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(title,12,10);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(sub,12,18);};
                const footer=()=>{doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(110,120,120);doc.text('Generated: '+generatedAtText+' | By: '+generatedBy,12,H-6);doc.text('Page '+doc.getCurrentPageInfo().pageNumber,265,H-6);};
                const drawTable=(headers,rows,widths,startY,rowH=6)=>{let y=startY,totalW=widths.reduce((a,b)=>a+b,0);const newPage=()=>{doc.addPage('a4','landscape');header('OFFICE ZIMMEDAR — REPORT','Continued | '+month);y=30;};
                    const drawHeader=()=>{let x=margin;doc.setFont('helvetica','bold');doc.setFontSize(7);headers.forEach((h,i)=>{doc.setFillColor(42,77,83);doc.rect(x,y,widths[i],rowH,'F');doc.setTextColor(255,255,255);doc.text(text(h,25),x+2,y+4);x+=widths[i];});y+=rowH;};
                    drawHeader();doc.setFont('helvetica','normal');rows.forEach((r,ri)=>{if(y>H-17){footer();newPage();drawHeader();}let x=margin;if(ri%2===0){doc.setFillColor(247,250,250);doc.rect(margin,y,totalW,rowH,'F');}r.forEach((v,i)=>{doc.setTextColor(55,65,81);doc.text(text(v,Math.max(10,Math.floor(widths[i]/2))),x+2,y+4);x+=widths[i];});y+=rowH;});return y;};
                const indexEntryCount=report.stats.length+1, indexPageCount=Math.max(1,Math.ceil(indexEntryCount/10)), summaryPage=indexPageCount+1, employeePages=[];
                // Reserve page 1 (and continuation index pages if needed) before the summary so every target page stays exact.
                header('OFFICE ZIMMEDAR — REPORT INDEX','Clickable Table of Contents | '+month);
                for(let ip=2;ip<=indexPageCount;ip++){doc.addPage('a4','landscape');header('OFFICE ZIMMEDAR — REPORT INDEX','Clickable Table of Contents — Continued | '+month);}
                doc.addPage('a4','landscape');
                doc.setPage(summaryPage);
                header('OFFICE ZIMMEDAR — PROGRESS REPORT','Employee Summary | '+month+' | '+generatedAtText+' | By: '+generatedBy);
                const total=report.stats.length,totalTasks=report.stats.reduce((n,s)=>n+s.tasks.length,0),done=report.stats.reduce((n,s)=>n+s.completed,0),taskPct=totalTasks?Math.round(done/totalTasks*100):0;
                const cards=[['Employees',total],['Total Tasks',totalTasks],['Completed',done],['Task Progress',taskPct+'%'],['Attendance Weight',report.aw+'%']];
                cards.forEach((c,i)=>{const x=10+i*55;doc.setFillColor(240,247,247);doc.roundedRect(x,31,50,18,3,3,'F');doc.setTextColor(75,109,112);doc.setFontSize(7);doc.text(c[0],x+3,37);doc.setTextColor(17,42,46);doc.setFontSize(12);doc.setFont('helvetica','bold');doc.text(String(c[1]),x+3,45);});
                doc.addImage(progressReportCanvasData(report.stats.map(s=>s.emp),report.stats.map(s=>s.attendancePct),'Attendance Performance'),'PNG',10,55,135,52);
                doc.addImage(progressReportCanvasData(report.stats.map(s=>s.emp),report.stats.map(s=>s.taskPct),'Task Progress'),'PNG',152,55,135,52);
                drawTable(['Employee / Department','Attendance %','Present','Absent','Leave','Weekoff','Tasks','Completed','Task %','Overall'],report.stats.map(s=>[s.emp,(s.department||'-')+' '+(s.employeeId?'('+s.employeeId+')':''),s.attendancePct+'%',s.present,s.absent,s.leave,s.weekoff,s.tasks.length,s.completed,s.taskPct+'%',s.overall+'%']),[45,50,22,18,18,18,18,20,20,24,24],112,6);footer();
                // Generate each employee report and record its starting page.
                report.stats.forEach(s=>{
                    doc.addPage('a4','landscape');
                    const startPage=doc.getCurrentPageInfo().pageNumber;
                    employeePages.push({name:s.emp,department:s.department||'',employeeId:s.employeeId||'',page:startPage});
                    header('EMPLOYEE REPORT',s.emp+' | '+(s.department||'Department not set')+(s.employeeId?' | '+s.employeeId:'')+' | '+month);
                    doc.setFillColor(245,249,249);doc.roundedRect(10,30,277,18,3,3,'F');
                    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(17,42,46);doc.text(s.emp,15,38);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(90,105,108);doc.text((s.department||'Department not set')+(s.employeeId?'  |  Employee ID: '+s.employeeId:''),15,44);
                    const vals=[['Attendance',s.attendancePct+'%'],['Present',s.present],['Absent',s.absent],['Leave',s.leave],['Weekoff',s.weekoff],['Tasks',s.tasks.length],['Completed',s.completed],['Task Progress',s.taskPct+'%'],['Overall',s.overall+'%']];
                    vals.forEach((v,i)=>{const x=10+i*31.5;doc.setFillColor(248,250,250);doc.roundedRect(x,52,29,17,2,2,'F');doc.setFontSize(6.5);doc.setTextColor(90,100,100);doc.text(v[0],x+2,58);doc.setFontSize(9);doc.setTextColor(17,42,46);doc.setFont('helvetica','bold');doc.text(String(v[1]),x+2,65);});
                    doc.addImage(progressReportCanvasData([s.emp],[s.attendancePct],'Attendance %'),'PNG',10,74,90,45);doc.addImage(progressReportCanvasData([s.emp],[s.taskPct],'Task %'),'PNG',105,74,90,45);
                    let yy=124;
                    yy=drawTable(['Date','In Time','Out Time','Status','Reason'],s.rows.map(a=>[a.Date||'-',a.InTime||'-',a.OutTime||'-',a.InTime?'Present':(String(a.Leave||'').toLowerCase().includes('leave')?'Leave':String(a.Leave||'').toLowerCase().includes('weekoff')?'Weekoff':'Absent'),a.Reason||a.Leave||'-']),[28,30,30,30,119],yy,5.2);
                    if(yy>H-55){footer();doc.addPage('a4','landscape');header('EMPLOYEE REPORT — TASK DETAILS',s.emp+' | '+month);yy=30;}
                    yy+=5;drawTable(['Task Assign By','Task','Timeline','Priority','Status','Time'],s.tasks.map(t=>[t.assignedBy||'-',t.taskName||'-',(t.startDate||'-')+' → '+(t.endDate||'-'),t.priority||'Normal',t.empStatus||'Pending',(Number(t.timeSpent)||0)+' min']),[38,82,55,30,45,25],yy,5.2);footer();
                });
                // Build the clickable index after all target pages are known.
                const indexRows=[{title:'Employee Summary',detail:'Overall attendance, task and completion summary',page:summaryPage}].concat(employeePages.map(x=>({title:x.name,detail:(x.employeeId?'Employee ID: '+x.employeeId+'  ·  ':'')+(x.department||'Department not set'),page:x.page})));
                for(let ip=1;ip<=indexPageCount;ip++){
                    doc.setPage(ip);
                    header('OFFICE ZIMMEDAR — REPORT INDEX',ip===1?('Clickable Table of Contents | '+month):('Clickable Table of Contents — Continued | '+month));
                    if(ip===1){doc.setFillColor(240,247,247);doc.roundedRect(10,31,277,16,3,3,'F');doc.setTextColor(17,42,46);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Select an employee/topic below to jump directly to its PDF page.',16,41);}
                    const start=(ip-1)*10, pageRows=indexRows.slice(start,start+10); let iy=ip===1?58:36;
                    pageRows.forEach((r,localIdx)=>{const i=start+localIdx;doc.setFillColor(i%2?250:243,248,248);doc.roundedRect(12,iy-5,273,10,2,2,'F');doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(17,42,46);doc.text(String(i+1)+'. '+text(r.title,38),18,iy+1);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(85,100,103);doc.text(text(r.detail,62),112,iy+1);doc.setFont('helvetica','bold');doc.setTextColor(37,155,148);doc.text('Page '+r.page,262,iy+1,{align:'right'});doc.link(12,iy-5,273,10,{pageNumber:r.page});iy+=12;});
                    footer();
                }
                doc.setPage(summaryPage);
                const safe='Progress_Report_'+month.replace('-','_')+'_'+generatedAt.toISOString().replace(/[:.]/g,'-').slice(0,19)+'.pdf';doc.save(safe);alert('Progress Report PDF ready. Page 1 par clickable Index diya gaya hai.');
            }catch(e){console.error(e);alert('PDF generate nahi ho saka. Please try again.');}
        }

        // ================= PROGRESS CHART =================
        function openProgressChartModal() {
            document.getElementById('analysationModal').style.display='block';
            const role=document.getElementById('displayRole').innerText, isManager=isManagerRole(role);
            const sel=document.getElementById('progressEmpFilter');
            sel.innerHTML='';
            if(isManager){(globalTeamMembers||[]).forEach(m=>sel.innerHTML+=`<option value="${m}">${m}</option>`); const f=document.getElementById('hodEmpFilter').value; if(f&&f!=='All')sel.value=f;} else {sel.innerHTML=`<option value="${document.getElementById('displayUser').innerText}">${document.getElementById('displayUser').innerText}</option>`;}
            const aw=performanceWeights.attendance; const tw=performanceWeights.task;
            document.getElementById('attendanceWeightage').value=aw; document.getElementById('taskWeightage').value=tw;
            const n=new Date(); document.getElementById('progressPeriodDate').valueAsDate=n; document.getElementById('progressPeriodMonth').value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; document.getElementById('progressPeriodYear').value=n.getFullYear(); toggleProgressPeriodInputs(); renderProgressChart();
        }
        function closeAnalysationModal(){document.getElementById('analysationModal').style.display='none';}
        function toggleProgressPeriodInputs(){const v=document.getElementById('progressPeriodType').value;['progressPeriodDateBox','progressPeriodMonthBox','progressPeriodYearBox'].forEach(id=>document.getElementById(id).classList.add('hidden'));if(v==='day'||v==='week')document.getElementById('progressPeriodDateBox').classList.remove('hidden');if(v==='month')document.getElementById('progressPeriodMonthBox').classList.remove('hidden');if(v==='year')document.getElementById('progressPeriodYearBox').classList.remove('hidden');}
        function getSelectedProgressPeriod(){const v=document.getElementById('progressPeriodType').value;let start,end,label='';const now=new Date();now.setHours(0,0,0,0);if(v==='day'){const x=document.getElementById('progressPeriodDate').value;if(!x)return null;const [y,m,d]=x.split('-');start=new Date(+y,+m-1,+d);end=new Date(start);label='Daily';}else if(v==='week'){const x=document.getElementById('progressPeriodDate').value;if(!x)return null;const [y,m,d]=x.split('-');end=new Date(+y,+m-1,+d);start=new Date(end);start.setDate(start.getDate()-6);label='Weekly';}else if(v==='month'){const x=document.getElementById('progressPeriodMonth').value;if(!x)return null;const [y,m]=x.split('-');start=new Date(+y,+m-1,1);end=new Date(+y,+m,0);label='Monthly';}else if(v==='year'){const y=Number(document.getElementById('progressPeriodYear').value);if(!y)return null;start=new Date(y,0,1);end=new Date(y,11,31);label='Yearly';}else return null;return {start,end,label};}

        function applyGradeColor(el, grade){ if(!el) return; el.classList.remove('text-emerald-600','text-blue-600','text-amber-600','text-red-600','text-[#10b981]','text-[#259b94]','text-[#f59e0b]','text-red-500'); const colors={A:'text-emerald-600',B:'text-blue-600',C:'text-amber-600',D:'text-red-600'}; el.classList.add(colors[grade] || colors.D); }
         function getGrade(score){score=Math.max(0,Math.min(100,Math.round(score||0)));if(score>=90)return ['A','Mumtaz'];if(score>=80)return ['B','Behtar'];if(score>=70)return ['C','Munasib'];return ['D','Kamzor'];}
        function getTaskScore(tasks, date) {
            const active=tasks.filter(t=>{const s=parseReportDate(t.startDate),e=parseReportDate(t.endDate);return s&&e&&date>=s&&date<=e;});
            if(!active.length)return null;
            let total=0;
            active.forEach(t=>{const st=String(t.empStatus||'').toLowerCase();if(st==='completed'){const info=taskDeadlineInfo(t);total+=info.label.indexOf('Delayed')>-1?50:100;}});
            return total/active.length;
        }
        function getAttendanceScore(date, records) {
            const key=String(date.getDate()).padStart(2,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+date.getFullYear();
            const r=(records||[]).find(a=>String(a.Date)===key); if(!r)return 0;
            const leave=String(r.Leave||'').toLowerCase(); if(leave.includes('weekoff')||leave.includes('leave'))return null; return r.InTime?100:0;
        }
        function periodScore(tasks, records, start, end, aw, tw) {
            let a=[],t=[]; for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const as=getAttendanceScore(d,records);if(as!==null)a.push(as);const ts=getTaskScore(tasks,d);if(ts!==null)t.push(ts);} const att=a.length?a.reduce((x,y)=>x+y,0)/a.length:null, task=t.length?t.reduce((x,y)=>x+y,0)/t.length:null; let overall=0; if(att!==null&&task!==null) overall=(att*aw+task*tw)/100; else if(att!==null) overall=att; else if(task!==null) overall=task; return {att:att===null?0:att,task:task===null?0:task,overall};
        }
        function renderProgressChart(){
            const aw=Number(performanceWeights.attendance)||50,tw=Number(performanceWeights.task)||50,err=document.getElementById('progressWeightError');
            if(!Number.isFinite(aw)||!Number.isFinite(tw)||aw<0||tw<0||aw+tw!==100){err.classList.remove('hidden');return;}err.classList.add('hidden');document.getElementById('weightageText').innerText=`${aw} / ${tw}`;
            const selected=document.getElementById('progressEmpFilter').value, tasks=(globalAllTasks||[]).filter(t=>!selected||String(t.assignedTo).toLowerCase()===String(selected).toLowerCase()), records=(globalMonthlyFullAttendance||[]).filter(a=>!selected||String(a.Employee).toLowerCase()===String(selected).toLowerCase());
            const now=new Date();now.setHours(0,0,0,0);const dayStart=new Date(now),weekStart=new Date(now);weekStart.setDate(weekStart.getDate()-6);const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
            const day=periodScore(tasks,records,dayStart,now,aw/100,tw/100),week=periodScore(tasks,records,weekStart,now,aw/100,tw/100),month=periodScore(tasks,records,monthStart,now,aw/100,tw/100);
            const custom=getSelectedProgressPeriod(); if(custom){ custom.cp=periodScore(tasks,records,custom.start,custom.end,aw/100,tw/100); const cp=custom.cp; const cg=getGrade(cp.overall); document.getElementById('scoreDaily').innerText=`${Math.round(cp.overall)}%`; document.getElementById('gradeDaily').innerText=`${cg[0]} (${cg[1]})`; applyGradeColor(document.getElementById('gradeDaily'),cg[0]); }
            if(!custom)[['gradeDaily','scoreDaily',day],['gradeWeekly','scoreWeekly',week],['gradeMonthly','scoreMonthly',month]].forEach(x=>{const g=getGrade(x[2].overall);const ge=document.getElementById(x[0]);const se=document.getElementById(x[1]);if(ge){ge.innerText=`${g[0]} (${g[1]})`;applyGradeColor(ge,g[0]);}if(se)se.innerText=`${Math.round(x[2].overall)}%`;});
            const body=document.getElementById('progressScoreBody');body.innerHTML='';let chartLabels=['Today','This Week','This Month'],chartData=[day.overall,week.overall,month.overall];if(custom){const g=getGrade(custom.cp?custom.cp.overall:0);const cp=custom.cp||periodScore(tasks,records,custom.start,custom.end,aw/100,tw/100);body.innerHTML=`<tr class="border-t"><td class="p-3 font-bold">${custom.label}</td><td class="p-3 text-center">${Math.round(cp.att)}%</td><td class="p-3 text-center">${Math.round(cp.task)}%</td><td class="p-3 text-center font-bold">${Math.round(cp.overall)}%</td><td class="p-3 text-center font-bold">${g[0]} (${g[1]})</td></tr>`;chartLabels=[custom.label];chartData=[cp.overall];}else{[['Today',day],['This Week',week],['This Month',month]].forEach(x=>{const g=getGrade(x[1].overall);body.innerHTML+=`<tr class="border-t"><td class="p-3 font-bold">${x[0]}</td><td class="p-3 text-center">${Math.round(x[1].att)}%</td><td class="p-3 text-center">${Math.round(x[1].task)}%</td><td class="p-3 text-center font-bold">${Math.round(x[1].overall)}%</td><td class="p-3 text-center font-bold">${g[0]} (${g[1]})</td></tr>`;});}
            const ctx=document.getElementById('monthlyPerformanceChart').getContext('2d');if(monthlyChartInst)monthlyChartInst.destroy();monthlyChartInst=new Chart(ctx,{type:'bar',data:{labels:chartLabels,datasets:[{label:'Overall Score',data:chartData,backgroundColor:'#2a4d53',barPercentage:.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100},x:{grid:{display:false}}}}});
        }

        // ================= PROGRESS CARD MODAL =================
        function openProgressCardModal() {
            document.getElementById('progressCardModal').style.display = 'block';
            document.getElementById('progFilterType').value = 'all';
            toggleProgFilterInputs();
            applyProgressFilter(); 
        }
        function closeProgressCardModal() { document.getElementById('progressCardModal').style.display = 'none'; }
        function toggleProgFilterInputs() {
            const val = document.getElementById('progFilterType').value;
            document.getElementById('progDateInputBox').classList.add('hidden');
            document.getElementById('progMonthInputBox').classList.add('hidden');
            document.getElementById('progYearInputBox').classList.add('hidden');
            if(val === 'day') document.getElementById('progDateInputBox').classList.remove('hidden');
            if(val === 'month') document.getElementById('progMonthInputBox').classList.remove('hidden');
            if(val === 'year') document.getElementById('progYearInputBox').classList.remove('hidden');
        }
        function applyProgressFilter() {
            const fType = document.getElementById('progFilterType').value;
            let filteredTasks = globalAllTasks;
            if (fType === 'day') {
                const dateVal = document.getElementById('progFilterDate').value;
                if(dateVal) {
                    const [y,m,d] = dateVal.split('-');
                    const targetStr = `${d}-${m}-${y}`;
                    filteredTasks = globalAllTasks.filter(t => t.startDate === targetStr || t.endDate === targetStr);
                }
            } else if (fType === 'month') {
                const monthVal = document.getElementById('progFilterMonth').value;
                if(monthVal) {
                    const [y,m] = monthVal.split('-');
                    const targetStr = `${m}-${y}`;
                    filteredTasks = globalAllTasks.filter(t => (t.startDate && t.startDate.includes(targetStr)) || (t.endDate && t.endDate.includes(targetStr)));
                }
            } else if (fType === 'year') {
                const yearVal = document.getElementById('progFilterYear').value;
                if(yearVal) {
                    filteredTasks = globalAllTasks.filter(t => (t.startDate && t.startDate.includes(yearVal)) || (t.endDate && t.endDate.includes(yearVal)));
                }
            }
            renderProgressCardTable(filteredTasks);
        }
        function renderProgressCardTable(tasks) {
            const tbody = document.getElementById('progressCardBody');
            tbody.innerHTML = '';
            if (tasks.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500 font-medium italic">No tasks found for the selected period.</td></tr>`;
                return;
            }
            tasks.forEach(t => {
                let prioColorClass = 'dot-green'; let pLabel = 'Normal';
                if(t.priority.toLowerCase() === 'high') { prioColorClass = 'dot-red'; pLabel = 'High'; }
                if(t.priority.toLowerCase() === 'urgent') { prioColorClass = 'dot-red'; pLabel = 'Urgent'; }

                let sLabel = 'In Progress'; let statColorClass = 'dot-orange'; let progPercent = 40; 
                if (t.empStatus.toLowerCase() === 'completed') {
                    sLabel = 'Done'; statColorClass = 'dot-green'; progPercent = 100;
                } else if (t.empStatus.toLowerCase() === 'incomplete') {
                    sLabel = 'In Progress'; statColorClass = 'dot-orange'; progPercent = 50;
                } else {
                    progPercent = 0; 
                }

                let displayTime = t.timeSpent ? t.timeSpent + ' min' : '-';
                tbody.innerHTML += `
                    <tr class="transition hover:bg-gray-50">
                        <td class="blue-cell">${t.taskName}</td>
                        <td class="light-cell font-medium">${t.assignedTo}</td>
                        <td class="light-cell font-medium"><span class="dot ${prioColorClass}"></span> ${pLabel}</td>
                        <td class="light-cell font-bold text-gray-600">${displayTime}</td>
                        <td class="light-cell font-medium"><span class="dot ${statColorClass}"></span> ${sLabel}</td>
                        <td class="light-cell">
                            <div class="flex items-center gap-3 w-full">
                                <span class="text-xs font-bold w-10 text-right">${progPercent}%</span>
                                <div class="progress-bar-bg shadow-inner">
                                    <div class="progress-bar-fill transition-all duration-1000 ease-out" style="width: ${progPercent}%"></div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        // ================= PROJECT SCHEDULE MODAL =================
        function parseDDMMYYYY(dateStr) {
            if(!dateStr || dateStr === '-') return new Date();
            const parts = dateStr.split('-');
            if(parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]);
            return new Date();
        }
        function calcDaysDiff(startStr, endStr) {
            if(startStr === '-' || endStr === '-') return '-';
            const s = parseDDMMYYYY(startStr);
            const e = parseDDMMYYYY(endStr);
            const diffTime = e - s;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return diffDays >= 0 ? diffDays + 1 : 0; 
        }
        function openScheduleModal() {
            document.getElementById('scheduleModal').style.display = 'block';
            let leader = document.getElementById('displayRole').innerText === 'emp' ? document.getElementById('displayUser').innerText : "Department Head";
            document.getElementById('schedLead').innerText = leader;
            let pStart = globalAllTasks.length > 0 ? globalAllTasks[0].startDate : "--";
            document.getElementById('schedStartDate').innerText = pStart;
            const tbody = document.getElementById('scheduleCardBody');
            tbody.innerHTML = '';
            if (globalAllTasks.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500 font-medium italic">No schedule data available.</td></tr>`;
                return;
            }
            globalAllTasks.forEach((t, index) => {
                let progPercent = 0; 
                if (t.empStatus.toLowerCase() === 'completed') progPercent = 100;
                else if (t.empStatus.toLowerCase() === 'incomplete') progPercent = 50;
                let days = calcDaysDiff(t.startDate, t.endDate);
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-50 transition">
                        <td class="sched-grey-cell border-b text-[#2a4d53]">${index + 1}</td>
                        <td class="border-b pl-4 font-semibold text-gray-800">${t.taskName}</td>
                        <td class="border-b text-center">${t.assignedTo}</td>
                        <td class="border-b text-center text-[#7db0b1]">${t.startDate}</td>
                        <td class="border-b text-center text-[#7db0b1]">${t.endDate}</td>
                        <td class="border-b text-center font-bold">${days}</td>
                        <td class="border-b text-center ${progPercent === 100 ? 'bg-[#e1ebea] font-bold text-[#2a4d53]' : ''}">${progPercent}%</td>
                    </tr>
                `;
            });
        }
        function closeScheduleModal() { document.getElementById('scheduleModal').style.display = 'none'; }

        // ================= ATTENDANCE ONE VIEW =================
        function openOneViewModal() {
            document.getElementById('oneViewModal').style.display = 'block';
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            document.getElementById('oneViewMonthPicker').value = `${y}-${m}`;
            document.getElementById('attendanceAnalyticsDate').value = `${y}-${m}-${d}`;
            document.getElementById('attendanceAnalyticsYear').value = y;
            populateAttendanceAnalyticsEmployees();
            toggleAttendanceViewInputs();
            fetchOneViewData();
        }
        function closeOneViewModal() { document.getElementById('oneViewModal').style.display = 'none'; }

        function populateAttendanceAnalyticsEmployees() {
            const sel = document.getElementById('attendanceAnalyticsEmployee');
            if(!sel) return;
            const role = String(document.getElementById('displayRole').innerText || '').toLowerCase();
            const me = document.getElementById('displayUser').innerText || '';
            sel.innerHTML = '';
            if(role.indexOf('admin') > -1 || role.indexOf('hod') > -1) {
                sel.innerHTML = '<option value="All">All Employees</option>';
                (globalTeamMembers || []).forEach(n => { const meta=attendanceMetaForUser(n)||{}; const label=meta.employeeId?`${n} — ${meta.employeeId}`:n; sel.innerHTML += `<option value="${String(n).replace(/"/g,'&quot;')}">${escapeHtml(label)}</option>`; });
            } else {
                const myMeta=attendanceMetaForUser(me)||{}; sel.innerHTML = `<option value="${me}">${escapeHtml(myMeta.employeeId?me+' — '+myMeta.employeeId:me)}</option>`;
            }
        }

        function toggleAttendanceViewInputs() {
            const type = document.getElementById('attendanceViewType').value;
            document.getElementById('attendanceDailyInputBox').classList.toggle('hidden', !(type === 'daily' || type === 'weekly'));
            document.getElementById('attendanceMonthlyInputBox').classList.toggle('hidden', type !== 'monthly');
            document.getElementById('attendanceYearlyInputBox').classList.toggle('hidden', type !== 'yearly');
        }

        function parseAttendanceDateValue(v) {
            if(!v) return null;
            const m = String(v).match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if(m) return new Date(+m[3], +m[2]-1, +m[1]);
            const d = new Date(v);
            return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }

        function attendanceDateKey(d) {
            return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        }

        function attendancePeriodDates(type) {
            const dates = [];
            let base;
            if(type === 'monthly') {
                const mv = document.getElementById('oneViewMonthPicker').value;
                if(!mv) return dates;
                const [y,m] = mv.split('-').map(Number);
                const count = new Date(y,m,0).getDate();
                for(let d=1; d<=count; d++) dates.push(new Date(y,m-1,d));
            } else if(type === 'yearly') {
                const y = Number(document.getElementById('attendanceAnalyticsYear').value);
                if(!y) return dates;
                for(let m=0;m<12;m++){ const count=new Date(y,m+1,0).getDate(); for(let d=1;d<=count;d++) dates.push(new Date(y,m,d)); }
            } else {
                base = parseAttendanceDateValue(document.getElementById('attendanceAnalyticsDate').value) || new Date();
                if(type === 'daily') dates.push(base);
                else {
                    const day = base.getDay();
                    const start = new Date(base); start.setDate(base.getDate() - day);
                    for(let i=0;i<7;i++){ const x=new Date(start); x.setDate(start.getDate()+i); dates.push(x); }
                }
            }
            return dates;
        }

        function attendanceMetaForUser(name) {
            const needle=String(name||'').trim().toLowerCase();
            const found=(globalTeamMemberMeta||[]).find(x=>[x.username,x.displayName,x.employeeId].some(v=>String(v||'').trim().toLowerCase()===needle));
            return found || {username:name,weekoff:'Sunday',department:'',employeeId:(String(name||'').trim().toLowerCase()===String(document.getElementById('displayUser')?.innerText||'').trim().toLowerCase()?(window.currentUserEmployeeId||''):'')};
        }

        function officeEventForDate(date){ const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; return (globalOfficeEvents||[]).find(ev=>key>=String(ev.fromDate||"") && key<=String(ev.toDate||ev.fromDate||""))||null; }

        function attendanceIsWorkingDay(date, weekoff, username) {
            return effectiveWorkingDay(date, weekoff, username);
        }

        function uniqueAttendanceRecords(records) {
            const map = new Map();
            (records || []).forEach(a => {
                const emp=String(a.Employee||'').trim().toLowerCase(), date=String(a.Date||'').trim();
                if(!emp || !date) return;
                const key=emp+'|'+date, prev=map.get(key);
                if(!prev) { map.set(key,a); return; }
                const score=x => (x && x.InTime ? 4 : 0) + (x && String(x.Leave||'').toLowerCase().includes('leave') ? 2 : 0) + (x && String(x.Leave||'').toLowerCase().includes('weekoff') ? 1 : 0);
                if(score(a)>=score(prev)) map.set(key,a);
            });
            return Array.from(map.values());
        }

        function attendanceRecordFor(records, user, key) {
            return (records||[]).find(a=>String(a.Employee||'').toLowerCase()===String(user).toLowerCase() && String(a.Date)===key);
        }

        function renderAttendanceAnalytics(type, selectedUser, sourceRecords) {
            const allUsers=(globalTeamMembers||[]).slice();
            const users = selectedUser && selectedUser !== 'All' ? [selectedUser] : allUsers;
            const dates=attendancePeriodDates(type);
            const records=uniqueAttendanceRecords(sourceRecords !== undefined ? sourceRecords : (globalMonthlyFullAttendance||[]));
            let totalAvailability=0,totalPresence=0,totalAbsence=0,totalLeave=0,totalWeekoff=0;
            const daily=[];
            const cutoff=new Date(); cutoff.setHours(0,0,0,0);

            users.forEach(user=>{
                const meta=attendanceMetaForUser(user);
                dates.forEach(dt=>{
                    const isPast=dt<=cutoff;
                    const event=officeEventForDate(dt);
                    if(event) return;
                    const working=attendanceIsWorkingDay(dt,meta.weekoff,meta.username||name);
                    if(!working){ totalWeekoff++; return; }
                    totalAvailability++;
                    const key=attendanceDateKey(dt);
                    const rec=attendanceRecordFor(records,user,key);
                    const recStatus=String(rec?.Status||'').toLowerCase();
                    if(rec && recStatus==='approved') totalPresence++;
                    else if(rec && String(rec.Leave||'').toLowerCase().includes('leave')) totalLeave++;
                    else if(isPast) totalAbsence++;
                });
            });

            const denom=totalPresence+totalAbsence+totalLeave;
            const pct=denom?Math.round(totalPresence/denom*100):0;
            document.getElementById('attTotalEmployees').innerText=users.length;
            document.getElementById('attTotalAvailability').innerText=totalAvailability;
            document.getElementById('attTotalPresence').innerText=totalPresence;
            document.getElementById('attTotalAbsence').innerText=totalAbsence;
            document.getElementById('attPresencePercent').innerText=pct+'%';
            document.getElementById('attLegendPresent').innerText=totalPresence;
            document.getElementById('attLegendAbsent').innerText=totalAbsence;
            document.getElementById('attLegendLeave').innerText=totalLeave;

            const presentDeg=denom?Math.round(totalPresence/denom*360):0;
            const absentDeg=denom?Math.round(totalAbsence/denom*360):0;
            const leaveDeg=Math.max(0,360-presentDeg-absentDeg);
            document.getElementById('attendanceDonut').style.background=`conic-gradient(#8fb0b9 0deg ${presentDeg}deg,#d1d5db ${presentDeg}deg ${presentDeg+absentDeg}deg,#cfe3b7 ${presentDeg+absentDeg}deg ${presentDeg+absentDeg+leaveDeg}deg)`;
            document.getElementById('attendanceDonutText').innerText=pct+'%';

            const trend=document.getElementById('attendanceTrendChart');
            trend.innerHTML='';
            let groups=[];
            if(type==='yearly'){
                for(let m=0;m<12;m++) groups.push({label:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m],dates:dates.filter(d=>d.getMonth()===m)});
            } else if(type==='monthly'){
                groups=dates.map(d=>({label:String(d.getDate()),dates:[d]}));
            } else {
                groups=dates.map(d=>({label:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],dates:[d]}));
            }
            groups.forEach(g=>{
                let gp=0, ga=0;
                users.forEach(user=>{
                    const meta=attendanceMetaForUser(user);
                    g.dates.forEach(dt=>{
                        if(officeEventForDate(dt) || !attendanceIsWorkingDay(dt,meta.weekoff,meta.username||name) || dt>cutoff) return;
                        const rec=attendanceRecordFor(records,user,attendanceDateKey(dt));
                        const recStatus=String(rec?.Status||'').toLowerCase();
                        if(rec&&recStatus==='approved') gp++; else if(!(rec&&String(rec.Leave||'').toLowerCase().includes('leave'))) ga++;
                    });
                });
                const max=Math.max(1,gp+ga), h=Math.max(4,Math.round(gp/max*120));
                trend.innerHTML+=`<div class="flex flex-col items-center justify-end min-w-[30px] h-full"><div class="text-[9px] font-bold text-[#2a4d53] mb-1">${gp}</div><div class="w-5 bg-[#8fb0b9] rounded-t" style="height:${h}px"></div><div class="text-[9px] text-gray-500 mt-1">${g.label}</div></div>`;
            });
        }

        function fetchOneViewData() {
            const loading=document.getElementById('oneViewLoading');
            loading.style.display='block';
            const type=document.getElementById('attendanceViewType').value;
            const selectedUser=document.getElementById('attendanceAnalyticsEmployee').value;
            renderAttendanceAnalytics(type,selectedUser);

            const monthYear=document.getElementById('oneViewMonthPicker').value;
            const formData=new FormData();
            formData.append('action','getOneViewAttendance');
            formData.append('monthYear',monthYear);
            formData.append('targetUser',selectedUser);
            formData.append('sessionToken',sessionToken);

            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:formData})
            .then(res=>res.json())
            .then(data=>{
                loading.style.display='none';
                if(data.status==='success') {
                    renderOneViewTable(data.members,data.records,monthYear,selectedUser);
                    // Monthly analytics must use the exact same server records as the table.
                    // This prevents cached/duplicate attendance from making the cards disagree with the grid.
                    if(type==='monthly') renderAttendanceAnalytics(type,selectedUser,data.records);
                    else renderAttendanceAnalytics(type,selectedUser);
                } else alert(data.message||'Unable to load attendance sheet.');
            })
            .catch(()=>{loading.style.display='none'; renderOneViewTable(globalTeamMembers||[],globalMonthlyFullAttendance||[],monthYear,selectedUser);});
        }

        function renderOneViewTable(members, records, monthYear, selectedUser) {
            // Attendance is Present only after approval; support both YYYY-MM-DD and DD-MM-YYYY records.
            const normalizeAttendanceStatus = (r) => {
                const st=String(r?.status||r?.Status||'').trim().toLowerCase();
                if(st==='approved'||st==='present'||st==='p') return 'P';
                if(st==='rejected') return 'A';
                if(String(r?.leave||r?.Leave||'').toLowerCase().includes('leave')) return 'L';
                if(String(r?.leave||r?.Leave||'').toLowerCase().includes('weekoff')) return 'W';
                return '';
            };
            const attendanceDayNumber = (value) => {
                const raw=String(value||'').trim();
                let m=raw.match(/^\d{4}-\d{2}-(\d{2})$/); if(m) return Number(m[1]);
                m=raw.match(/^(\d{2})-\d{2}-\d{4}$/); if(m) return Number(m[1]);
                return NaN;
            };
            const [yStr,mStr]=monthYear.split('-'), year=parseInt(yStr,10), month=parseInt(mStr,10);
            const daysInMonth=new Date(year,month,0).getDate();
            let visibleMembers=(selectedUser&&selectedUser!=='All')?[selectedUser]:members;
            let theadHtml=`<tr class="ov-teal text-xs"><th class="p-2 border text-center">#</th><th class="p-2 border min-w-[210px]">Employee / Department</th>`;
            for(let d=1;d<=daysInMonth;d++) theadHtml+=`<th class="p-1 border text-center ov-yellow w-6">${d}</th>`;
            theadHtml+=`<th class="p-2 border text-center font-extrabold text-green-200">P</th><th class="p-2 border text-center font-extrabold text-red-200">A</th><th class="p-2 border text-center font-extrabold text-yellow-200">L</th><th class="p-2 border text-center font-extrabold text-blue-200">W</th><th class="p-2 border text-center font-extrabold text-purple-200">E</th><th class="p-2 border text-center font-extrabold text-white">%</th></tr>`;
            document.getElementById('oneViewThead').innerHTML=theadHtml;

            const matrix={}; visibleMembers.forEach(m=>matrix[m]={});
            records.forEach(r=>{
                if(!matrix[r.user]) return;
                const d=attendanceDayNumber(r.date);
                if(!Number.isFinite(d)||d<1||d>daysInMonth) return;
                const status=normalizeAttendanceStatus(r);
                if(status==='P'||!matrix[r.user][d]) matrix[r.user][d]=status;
            });
            const tbody=document.getElementById('oneViewTbody'); tbody.innerHTML='';
            const today=new Date(); today.setHours(0,0,0,0);
            visibleMembers.forEach((m,idx)=>{
                let p=0,a=0,l=0,w=0,eCount=0;
                const meta=attendanceMetaForUser(m);
                const dept=meta.department||''; const eid=meta.employeeId||'';
                let row=`<tr class="hover:bg-[#e6fcf5] transition"><td class="p-2 border text-center font-bold text-gray-500">${idx+1}</td><td class="p-2 border ov-light-teal oneview-employee-link" data-employee="${progressReportEscape(m)}" onclick="openEmployeeProgressDirect(this.dataset.employee)" title="Open ${progressReportEscape(m)} report"><div class="employee-name-line">${progressReportEscape(m)}</div><div class="employee-dept-line">${progressReportEscape(dept||'Department not set')}</div>${eid?`<div class="employee-id-line">ID: ${progressReportEscape(eid)}</div>`:''}</td>`;
                for(let d=1;d<=daysInMonth;d++){
                    let st=matrix[m][d];
                    const dt=new Date(year,month-1,d);
                    const ev=officeEventForDate(dt);
                    if(ev) st='E';
                    if(!st){
                        if(!attendanceIsWorkingDay(dt,meta.weekoff,meta.username||m)) st='W';
                        else if(dt<today) st='A';
                        else st='-';
                    }
                    if(st==='P')p++; if(st==='A')a++; if(st==='L')l++; if(st==='W')w++; if(st==='E')eCount++;
                    let color='text-gray-400';
                    if(st==='P')color='text-[#259b94] font-extrabold';
                    if(st==='A')color='text-red-500 font-extrabold bg-red-50';
                    if(st==='L')color='text-yellow-600 font-extrabold bg-yellow-50';
                    if(st==='W')color='text-blue-500 font-extrabold bg-blue-50';
                    if(st==='E')color='text-purple-600 font-extrabold bg-purple-50';
                    row+=`<td class="p-1 border text-center text-xs ${color}">${st}</td>`;
                }
                const working=p+a;
                const perc=working?Math.round(p/working*100):0;
                row+=`<td class="p-2 border text-center font-bold text-[#259b94] bg-[#e1ebea]">${p}</td><td class="p-2 border text-center font-bold text-red-500 bg-red-50">${a}</td><td class="p-2 border text-center font-bold text-yellow-600 bg-yellow-50">${l}</td><td class="p-2 border text-center font-bold text-blue-500 bg-blue-50">${w}</td><td class="p-2 border text-center font-bold text-purple-600 bg-purple-50">${eCount}</td><td class="p-2 border text-center font-bold text-white bg-[#259b94] text-sm shadow-inner">${perc}%</td></tr>`;
                tbody.innerHTML+=row;
            });
            if(!visibleMembers.length) tbody.innerHTML=`<tr><td colspan="${daysInMonth+7}" class="text-center p-8 text-gray-500 italic font-medium">No employees found.</td></tr>`;
        }

        // ================= ADVANCE SCHEDULE REQUEST =================
        function openAdvanceScheduleModal() {
            const now=new Date(), day=now.getDate(), y=now.getFullYear(), m=now.getMonth();
            const minMonth=new Date(y,m+(day<=15?1:2),1), maxMonth=new Date(y+2,m+1,0);
            const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            document.getElementById('advanceScheduleDate').min=fmt(minMonth); document.getElementById('advanceScheduleDate').max=fmt(maxMonth); document.getElementById('advanceScheduleDate').value='';
            document.getElementById('advanceScheduleType').value='Leave'; document.getElementById('advanceScheduleReason').value=''; document.getElementById('advanceScheduleLocation').value=''; document.getElementById('meetingMode').value='Online';
            ['meetingFrom','meetingTo','journeyStart','journeyComplete','newWeekoffDate','advanceScheduleEndDate'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
            const info=document.getElementById('advanceScheduleWindowInfo'); if(info) info.innerText=day<=15 ? `Advance Schedule: next month se future 2+ months tak dates select karein. ${15-day} din baaqi.` : `15 tareekh cross ho chuki hai. Next month band hai; uske baad ke future months select karein.`;
            toggleAdvanceScheduleFields(); document.getElementById('advanceScheduleModal').style.display='block';
        }
        function closeAdvanceScheduleModal(){document.getElementById('advanceScheduleModal').style.display='none';}
        function isConfiguredWeekoffDate(dateStr){
            if(!dateStr) return false;
            const d=new Date(dateStr+'T12:00:00');
            const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const configured=String(window.currentUserWeekoff||'Sunday').trim().toLowerCase();
            return configured.split(',').map(x=>x.trim().toLowerCase()).indexOf(names[d.getDay()].toLowerCase())>-1;
        }
        function isAdjustedWeekoffDate(dateStr, username){
            if(!dateStr) return false;
            const user=String(username||document.getElementById('displayUser')?.innerText||'').trim().toLowerCase();
            return (globalAdvanceScheduleRequests||[]).some(r=>String(r.status||'').toLowerCase()==='approved' && String(r.requestType||'')==='Weekoff Adjustment' && String(r.employee||'').trim().toLowerCase()===user && String(r.requestDate||'')===dateStr);
        }
        function effectiveWorkingDay(date, weekoff, username){
            const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
            const regular=dayNames[date.getDay()].toLowerCase()===String(weekoff||'Sunday').toLowerCase();
            if(isAdjustedWeekoffDate(key,username)) return false;
            if(regular && (globalAdvanceScheduleRequests||[]).some(r=>String(r.status||'').toLowerCase()==='approved' && String(r.requestType||'')==='Weekoff Adjustment' && String(r.employee||'').trim().toLowerCase()===String(username||'').trim().toLowerCase())) return true;
            return !regular;
        }
        function toggleAdvanceScheduleFields(){
            const type=document.getElementById('advanceScheduleType').value;
            const rangeBox=document.getElementById('advanceScheduleEndDateBox');
            const isRange=['3 Days Qafila','Tarbiyati Ijtima'].includes(type);
            if(rangeBox) rangeBox.classList.toggle('hidden',!isRange);
            const start=document.getElementById('advanceScheduleDate'), end=document.getElementById('advanceScheduleEndDate');
            if(start&&end){ end.min=start.value||start.min||''; end.max=start.max||''; if(!isRange) end.value=''; }
            document.getElementById('meetingModeBox').classList.toggle('hidden',type!=='Meeting');
            document.getElementById('journeyTimeBox').classList.toggle('hidden',type!=='Meeting Journey');
            const wob=document.getElementById('weekoffAdjustmentBox');
            if(wob) wob.classList.toggle('hidden',type!=='Weekoff Adjustment');
            if(type==='Weekoff Adjustment'){
                const d=document.getElementById('advanceScheduleDate').value;
                if(d && isConfiguredWeekoffDate(d)){alert('Weekoff Adjustment ke liye regular Weekoff date nahi, Monday-Saturday ki working date select karein.');document.getElementById('advanceScheduleDate').value='';}
            }
            if(type!=='Meeting') document.getElementById('onlineDurationBox').classList.add('hidden');
            else toggleMeetingMode();
        }
        document.addEventListener('change',function(ev){
            if(ev.target && ev.target.id==='advanceScheduleDate'){
                const end=document.getElementById('advanceScheduleEndDate'); if(end){ end.min=ev.target.value||ev.target.min||''; end.max=ev.target.max||''; if(end.value && ev.target.value && end.value<ev.target.value) end.value=ev.target.value; }
                if(document.getElementById('advanceScheduleType')?.value==='Weekoff Adjustment'){
                    if(isConfiguredWeekoffDate(ev.target.value)){
                        alert('Weekoff Adjustment ke liye regular Weekoff date nahi, Monday-Saturday ki working date select karein.');
                        ev.target.value='';
                    }
                }
            }
        });
        function toggleMeetingMode(){
            const show=document.getElementById('advanceScheduleType').value==='Meeting' && document.getElementById('meetingMode').value==='Online';
            document.getElementById('onlineDurationBox').classList.toggle('hidden',!show);
        }
        let emergencyTaskTemplateCache=[];
        function openEmergencyTaskModal(){
            const todayKey=localDateKey();
            const selectedKey=document.getElementById('attendanceDate')?.value||todayKey;
            if(selectedKey!==todayKey){ alert('Today Urgent Task sirf current date ke liye available hai. Previous date par yeh freeze rahega.'); updateTodayUrgentTaskButtonState(); return; }
            const nonWorking=isLogWorkNonWorkingDate(todayKey);
            if(nonWorking){ alert(`Today Urgent Task frozen: ${nonWorking}. Office closed hai, is din urgent task request nahi ki ja sakti.`); updateTodayUrgentTaskButtonState(); return; }
            const today=new Date(); const key=today.toISOString().split('T')[0];
            const label=document.getElementById('emergencyTaskToday');if(label)label.textContent=today.toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'});
            const sel=document.getElementById('emergencyTaskTemplate');if(sel)sel.innerHTML='<option value="">Loading templates...</option>';
            const cat=document.getElementById('emergencyTaskCategory');if(cat)cat.value='';
            const ab=document.getElementById('emergencyTaskAssignBy');if(ab)ab.value='';
            document.getElementById('emergencyTaskDetails').value='';
            document.getElementById('emergencyTaskModal').style.display='block';
            const fd=new FormData();fd.append('action','getTodayUrgentTaskTemplates');fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{if(d.status!=='success')throw new Error(d.message||'Templates load failed');emergencyTaskTemplateCache=Array.isArray(d.templates)?d.templates:[];if(sel){sel.innerHTML='<option value="">-- Select Task Template --</option>'+emergencyTaskTemplateCache.map(t=>`<option value="${escapeHtml(t.templateId)}">${escapeHtml(t.taskName)} — ${escapeHtml(t.category||'-')}</option>`).join('');}}).catch(e=>{if(sel)sel.innerHTML='<option value="">Templates load nahi hue</option>';alert(e.message||'Templates load failed.');});
        }
        function applyEmergencyTaskTemplate(){const id=document.getElementById('emergencyTaskTemplate')?.value||'',t=emergencyTaskTemplateCache.find(x=>String(x.templateId)===String(id));const cat=document.getElementById('emergencyTaskCategory');if(cat)cat.value=t?.category||'';}
        function closeEmergencyTaskModal(){document.getElementById('emergencyTaskModal').style.display='none';}
        function submitEmergencyTaskRequest(){
            const todayKey=localDateKey();
            const selectedKey=document.getElementById('attendanceDate')?.value||todayKey;
            if(selectedKey!==todayKey){ alert('Today Urgent Task sirf current date ke liye available hai.'); updateTodayUrgentTaskButtonState(); return; }
            const nonWorking=isLogWorkNonWorkingDate(todayKey);
            if(nonWorking){ alert(`Today Urgent Task frozen: ${nonWorking}.`); updateTodayUrgentTaskButtonState(); return; }
            const templateId=document.getElementById('emergencyTaskTemplate')?.value||'',assignBy=document.getElementById('emergencyTaskAssignBy')?.value||'',details=document.getElementById('emergencyTaskDetails')?.value.trim()||'',today=todayKey;
            if(!templateId){alert('Task Template select karein.');return;} if(!assignBy){alert('Assign By select karein.');return;}
            const t=emergencyTaskTemplateCache.find(x=>String(x.templateId)===String(templateId));if(!t){alert('Selected template nahi mila.');return;}
            const fd=new FormData();fd.append('action','emergencyTaskRequest');fd.append('templateId',templateId);fd.append('requestDate',today);fd.append('assignBy',assignBy);fd.append('details',details);fd.append('sessionToken',sessionToken);
            const b=document.getElementById('emergencyTaskBtn');b.disabled=true;b.innerText='Sending...';
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Request sent');if(d.status==='success'){closeEmergencyTaskModal();fetchDashboardDataSilently();}}).catch(()=>alert('Today Urgent Task request failed.')).finally(()=>{b.disabled=false;b.innerText='Send Request';});
        }
        function submitAdvanceScheduleRequest(){
            const date=document.getElementById('advanceScheduleDate').value;
            const endDate=['3 Days Qafila','Tarbiyati Ijtima'].includes(document.getElementById('advanceScheduleType').value)?document.getElementById('advanceScheduleEndDate').value:'';
            const type=document.getElementById('advanceScheduleType').value;
            const reason=document.getElementById('advanceScheduleReason').value.trim(); const scheduleLocation=document.getElementById('advanceScheduleLocation').value.trim();
            const weekoffDate=type==='Weekoff Adjustment'?date:'';
            if(type==='Weekoff Adjustment' && (!date||isConfiguredWeekoffDate(weekoffDate))){alert('Weekoff Adjustment ke liye Monday-Saturday ki working date select karein.');return;}
            const mode=type==='Meeting'?document.getElementById('meetingMode').value:'';
            const meetingFrom=type==='Meeting'&&mode==='Online'?document.getElementById('meetingFrom').value:'';
            const meetingTo=type==='Meeting'&&mode==='Online'?document.getElementById('meetingTo').value:'';
            const journeyStart=type==='Meeting Journey'?document.getElementById('journeyStart').value:'';
            const journeyComplete=type==='Meeting Journey'?document.getElementById('journeyComplete').value:'';
            if(!date){alert('Please select future date.');return;}
            if(['3 Days Qafila','Tarbiyati Ijtima'].includes(type) && (!endDate||endDate<date)){alert('From Date aur To Date sahi select karein.');return;}
            if(type==='Meeting'&&mode==='Online'&&(!meetingFrom||!meetingTo)){alert('Online Meeting ke liye From aur To time select karein.');return;}
            if(type==='Meeting Journey'&&(!journeyStart||!journeyComplete)){alert('Journey Start aur Journey Complete time select karein.');return;}
            const btn=document.getElementById('advanceScheduleBtn'); btn.disabled=true; btn.innerText='Submitting...';
            const fd=new FormData(); fd.append('action','advanceScheduleRequest'); fd.append('requestDate',date); fd.append('endDate',endDate); fd.append('requestType',type); fd.append('reason',reason); fd.append('location',scheduleLocation); fd.append('weekoffDate',weekoffDate); fd.append('meetingMode',mode); fd.append('meetingFrom',meetingFrom); fd.append('meetingTo',meetingTo); fd.append('journeyStart',journeyStart); fd.append('journeyComplete',journeyComplete); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(data=>{
                alert(data.message||'Request submitted.');
                if(data.status==='success'){closeAdvanceScheduleModal();fetchDashboardDataSilently();}
            }).catch(()=>alert('Request submission failed.')).finally(()=>{btn.disabled=false;btn.innerText='Submit Request';});
        }
        function openAdvanceScheduleApprovalModal(){
            const box=document.getElementById('advanceScheduleRequestsList'); if(!box)return;
            box.innerHTML='<div class="p-6 text-center text-gray-500 italic"><i class="fas fa-spinner fa-spin mr-2"></i>Loading pending requests...</div>';
            const fd=new FormData(); fd.append('action','listAdvanceScheduleRequests'); fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(data=>{
                if(data.status!=='success') throw new Error(data.message||'Unable to load requests');
                globalAdvanceScheduleRequests=Array.isArray(data.requests)?data.requests:[];
                const reqs=globalAdvanceScheduleRequests.filter(r=>{const st=String(r.status??'').trim().toLowerCase();return !st||st==='pending';});
                if(!reqs.length){box.innerHTML='<div class="p-6 text-center text-gray-500 italic">No pending advance schedule requests.</div>';}
                else box.innerHTML=reqs.map(r=>`<div class="border border-[#b2d8d8] rounded-xl p-4 bg-[#f7fbfb]">
                    <div class="flex flex-col md:flex-row md:justify-between gap-2"><div><b class="text-[#112a2e]">${r.employee}</b><span class="text-xs text-gray-500 ml-2">${r.employeeId||''}</span><span class="text-xs text-gray-500 ml-2">${r.department||''}</span><span class="text-xs text-gray-500 ml-2">${r.requestDate}</span></div><span class="bg-[#e6fcf5] text-[#1f827c] px-3 py-1 rounded-full text-xs font-bold">${r.requestType}</span></div>
                    <div class="text-sm text-gray-600 mt-2"><b>Location:</b> ${r.location||'-'}<br>${r.details||'-'}</div>
                    <div class="mt-3 flex gap-2"><button onclick="editAdvanceSchedule(${r.rowIndex},${JSON.stringify(r.requestDate)},${JSON.stringify(r.details||'')})" class="bg-[#2a4d53] hover:bg-[#1e3e43] text-white px-4 py-2 rounded-lg text-sm font-bold">Edit</button><button onclick="${r.requestType==='Emergency Task'?`openUrgentTaskApprovalByRow(${r.rowIndex})`:`approveAdvanceSchedule(${r.rowIndex})`}" class="bg-[#259b94] hover:bg-[#1f827c] text-white px-4 py-2 rounded-lg text-sm font-bold">${r.requestType==='Emergency Task'?'Approve Emergency Task':'Approve & Assign'}</button><button onclick="rejectAdvanceSchedule(${r.rowIndex})" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Reject</button></div>
                </div>`).join('');
                document.getElementById('advanceScheduleApprovalModal').style.display='block';
            }).catch(err=>{box.innerHTML='<div class="p-6 text-center text-red-500">Requests load nahi ho sakin. '+(err.message||'Please try again.')+'</div>';});
        }
        function closeAdvanceScheduleApprovalModal(){document.getElementById('advanceScheduleApprovalModal').style.display='none';}
        function editAdvanceSchedule(rowIndex,currentDate,currentDetails){
            const date=prompt('Request Date (YYYY-MM-DD):',currentDate||''); if(date===null)return;
            const details=prompt('Update Details:',currentDetails||''); if(details===null)return;
            const fd=new FormData();fd.append('action','editAdvanceScheduleRequest');fd.append('rowIndex',rowIndex);fd.append('requestDate',date);fd.append('reason',details);fd.append('sessionToken',sessionToken);
            fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json()).then(d=>{alert(d.message||'Updated');if(d.status==='success'){openAdvanceScheduleApprovalModal();fetchDashboardDataSilently();}}).catch(()=>alert('Update failed.'));
        }
        function updateAdvanceScheduleRequest(rowIndex,status){
            const fd=new FormData();fd.append('action','updateAdvanceScheduleRequest');fd.append('rowIndex',rowIndex);fd.append('status',status);fd.append('sessionToken',sessionToken);
            return fetch(GOOGLE_SCRIPT_URL,{method:'POST',body:fd}).then(r=>r.json());
        }
        function openUrgentTaskApprovalByRow(rowIndex){
            const r=(globalAdvanceScheduleRequests||[]).find(x=>Number(x.rowIndex)===Number(rowIndex));
            if(!r)return;
            urgentTaskApprovalContext={key:'schedule-row|'+rowIndex,rowIndex:Number(rowIndex),action:'scheduleEmergency',employee:r.employee||'',task:r.taskName||'Today Urgent Task',assignBy:r.assignBy||'',approvalOwner:r.approvalOwner||''};
            const info=document.getElementById('urgentTaskApprovalInfo');if(info)info.innerHTML=`<b>${escapeHtml(r.employee||'Employee')}</b> • ${escapeHtml(r.taskName||'Today Urgent Task')}<br><span class="text-xs">Assign By: ${escapeHtml(r.assignBy||'-')}</span>`;
            const days=document.getElementById('urgentTaskApprovalDays');if(days)days.value='1';
            const m=document.getElementById('urgentTaskApprovalModal');if(m)m.style.display='block';
        }
        function confirmUrgentTaskApproval(){
            const item=urgentTaskApprovalContext;if(!item)return;
            const days=Number(document.getElementById('urgentTaskApprovalDays')?.value||0);if(!Number.isInteger(days)||days<1||days>31){alert('Working Days 1 se 31 ke beech dein.');return;}
            const btn=document.getElementById('urgentTaskApprovalBtn');if(btn){btn.disabled=true;btn.textContent='Saving...';}
            approvalCenterPost(item,'Approved','','',{durationDays:days}).then(d=>{if(d.status!=='success')throw new Error(d.message||'Approval update failed.');closeUrgentTaskApprovalModal();closeAdvanceScheduleApprovalModal();fetchDashboardDataSilently();setTimeout(loadApprovalAttendanceTaskCenter,200);alert(d.message||'Today Urgent Task approved.');}).catch(e=>alert(e.message||'Approval update failed.')).finally(()=>{if(btn){btn.disabled=false;btn.textContent='Approve & Add Task';}});
        }
        function approveAdvanceSchedule(rowIndex){updateAdvanceScheduleRequest(rowIndex,'Approved').then(d=>{alert(d.message||'Approved');if(d.status==='success'){closeAdvanceScheduleApprovalModal();setTimeout(fetchDashboardDataSilently,250);}}).catch(()=>alert('Update failed.'));}
        function rejectAdvanceSchedule(rowIndex){updateAdvanceScheduleRequest(rowIndex,'Rejected').then(d=>{alert(d.message||'Rejected');if(d.status==='success'){closeAdvanceScheduleApprovalModal();setTimeout(fetchDashboardDataSilently,250);}}).catch(()=>alert('Update failed.'));}



        ['pointerdown','keydown','touchstart','scroll'].forEach(ev=>{
            document.addEventListener(ev,function(){touchLoginActivity_();},{passive:true});
        });
        document.addEventListener('visibilitychange',function(){if(!document.hidden)touchLoginActivity_();});
        document.addEventListener('DOMContentLoaded',function(){
            restorePersistedSession_();
            setTimeout(observeAssignedTaskTypeColumn_,500);
            setTimeout(observeAssignedTaskTypeColumn_,1500);
        });
