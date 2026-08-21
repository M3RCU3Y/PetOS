use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize};
use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder};

#[derive(Clone, Serialize, Debug)]
struct Point { x: f64, y: f64 }
#[derive(Clone, Serialize, Debug)]
struct Rect { x: f64, y: f64, width: f64, height: f64 }
#[derive(Clone, Serialize, Debug)]
struct MonitorInfo { id: String, rect: Rect, work_area: Rect, primary: bool, scale_factor: f64 }
#[derive(Clone, Serialize, Debug)]
struct DesktopWindow { id: String, title: String, app: String, rect: Rect, visible: bool, foreground: bool, minimized: bool }
#[derive(Clone, Serialize, Debug)]
struct DesktopSnapshot {
    monitors: Vec<MonitorInfo>, windows: Vec<DesktopWindow>, cursor: Point,
    cursor_speed: f64, cursor_buttons: u32, foreground_app: Option<String>,
    user_activity: String, seconds_since_new_window: f64,
    idle_seconds: f64, locked: bool,
}

struct SensorState {
    previous_cursor: Point,
    previous_cursor_at: Instant,
    seen_windows: Vec<String>,
    last_new_window_at: Instant,
}
struct DesktopState(Mutex<SensorState>);

impl Default for DesktopState {
    fn default() -> Self {
        let now = Instant::now();
        Self(Mutex::new(SensorState { previous_cursor: Point{x:0.0,y:0.0}, previous_cursor_at:now, seen_windows:Vec::new(), last_new_window_at:now-Duration::from_secs(3600) }))
    }
}

#[tauri::command]
fn get_desktop_snapshot(state: tauri::State<'_, DesktopState>) -> DesktopSnapshot {
    let raw = platform::snapshot();
    let mut sensor = state.0.lock().expect("PetOS sensor lock poisoned");
    let now = Instant::now();
    let dt = now.duration_since(sensor.previous_cursor_at).as_secs_f64().max(0.001);
    let cursor_speed = (((raw.cursor.x-sensor.previous_cursor.x).powi(2)+(raw.cursor.y-sensor.previous_cursor.y).powi(2)).sqrt()/dt).min(20_000.0);
    let ids: Vec<String> = raw.windows.iter().map(|w|w.id.clone()).collect();
    if ids.iter().any(|id| !sensor.seen_windows.contains(id)) && !sensor.seen_windows.is_empty() { sensor.last_new_window_at=now; }
    sensor.seen_windows=ids;sensor.previous_cursor=raw.cursor.clone();sensor.previous_cursor_at=now;
    let since=now.duration_since(sensor.last_new_window_at).as_secs_f64();
    let activity = if raw.locked { "idle" } else if raw.fullscreen { "fullscreen" } else if cursor_speed > 20.0 { "active" } else { "idle" };
    DesktopSnapshot { monitors:raw.monitors,windows:raw.windows,cursor:raw.cursor,cursor_speed,cursor_buttons:raw.cursor_buttons,foreground_app:raw.foreground_app,user_activity:activity.into(),seconds_since_new_window:since,idle_seconds:raw.idle_seconds,locked:raw.locked }
}

#[tauri::command]
fn set_interaction_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window=app.get_webview_window("main").ok_or("main window missing")?;
    window.set_ignore_cursor_events(!enabled).map_err(|e|e.to_string())?;
    if enabled { let _=window.set_focus(); }
    Ok(())
}

#[tauri::command]
fn set_overlay_visible(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window=app.get_webview_window("main").ok_or("main window missing")?;
    if enabled { window.show().map_err(|e|e.to_string())?; } else { window.hide().map_err(|e|e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn show_settings(app: tauri::AppHandle) -> Result<(), String> {
    let window=app.get_webview_window("main").ok_or("main window missing")?;
    window.show().map_err(|e|e.to_string())?;
    window.set_ignore_cursor_events(false).map_err(|e|e.to_string())?;
    let _=window.set_focus();
    window.emit("petos://show-settings", ()).map_err(|e|e.to_string())?;
    Ok(())
}

fn fit_overlay(app:&tauri::AppHandle) {
    if let Some(w)=app.get_webview_window("main") {
        let b=platform::virtual_bounds();
        let _=w.set_position(PhysicalPosition::new(b.0,b.1));
        let _=w.set_size(PhysicalSize::new(b.2.max(1) as u32,b.3.max(1) as u32));
        let _=w.set_always_on_top(true);
        let _=w.set_ignore_cursor_events(true);
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(DesktopState::default())
        .invoke_handler(tauri::generate_handler![get_desktop_snapshot,set_interaction_mode,set_overlay_visible,show_settings])
        .setup(|app| {
            fit_overlay(app.handle());
            let settings=MenuItem::with_id(app,"settings","Open PetOS",true,None::<&str>)?;
            let interact=MenuItem::with_id(app,"interact","Interact with pets",true,None::<&str>)?;
            let hide=MenuItem::with_id(app,"hide","Hide pets",true,None::<&str>)?;
            let quit=MenuItem::with_id(app,"quit","Quit",true,None::<&str>)?;
            let menu=Menu::with_items(app,&[&settings,&interact,&hide,&quit])?;
            let mut tray=TrayIconBuilder::new().menu(&menu).show_menu_on_left_click(false).tooltip("PetOS — your desktop habitat");
            if let Some(icon)=app.default_window_icon(){ tray=tray.icon(icon.clone()); }
            tray.on_menu_event(|app,event| match event.id().as_ref(){
                "settings"|"interact"=>{let _=show_settings(app.clone());},
                "hide"=>{if let Some(w)=app.get_webview_window("main"){let _=w.hide();}},
                "quit"=>app.exit(0), _=>{}
            }).build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PetOS");
}

#[cfg(target_os="windows")]
mod platform {
    use super::{DesktopWindow,MonitorInfo,Point,Rect};
    use std::mem::size_of;
    type BOOL=i32; type HWND=isize; type HMONITOR=isize; type LPARAM=isize; type DWORD=u32; type HANDLE=isize;
    #[repr(C)] #[derive(Clone,Copy)] struct RECT{left:i32,top:i32,right:i32,bottom:i32}
    #[repr(C)] #[derive(Clone,Copy)] struct POINT{x:i32,y:i32}
    #[repr(C)] struct MONITORINFO{cb_size:u32,rc_monitor:RECT,rc_work:RECT,dw_flags:u32}
    const MONITORINFOF_PRIMARY:u32=1; const GWL_EXSTYLE:i32=-20; const WS_EX_TOOLWINDOW:isize=0x00000080;
    const GW_OWNER:u32=4; const PROCESS_QUERY_LIMITED_INFORMATION:u32=0x1000;
    const SM_XVIRTUALSCREEN:i32=76;const SM_YVIRTUALSCREEN:i32=77;const SM_CXVIRTUALSCREEN:i32=78;const SM_CYVIRTUALSCREEN:i32=79;
    const DESKTOP_SWITCHDESKTOP:u32=0x0002;
    #[repr(C)] struct LASTINPUTINFO{cb_size:u32,dw_time:DWORD}
    #[link(name="user32")] extern "system"{
        fn EnumWindows(cb:unsafe extern "system" fn(HWND,LPARAM)->BOOL,l:LPARAM)->BOOL;
        fn IsWindowVisible(h:HWND)->BOOL;fn IsIconic(h:HWND)->BOOL;fn GetWindowRect(h:HWND,r:*mut RECT)->BOOL;fn GetForegroundWindow()->HWND;
        fn GetWindowTextLengthW(h:HWND)->i32;fn GetWindowTextW(h:HWND,s:*mut u16,n:i32)->i32;fn GetWindowLongPtrW(h:HWND,i:i32)->isize;fn GetWindow(h:HWND,c:u32)->HWND;
        fn GetWindowThreadProcessId(h:HWND,p:*mut DWORD)->DWORD;fn GetCursorPos(p:*mut POINT)->BOOL;fn GetAsyncKeyState(k:i32)->i16;
        fn EnumDisplayMonitors(dc:isize,clip:*const RECT,cb:unsafe extern "system" fn(HMONITOR,isize,*mut RECT,LPARAM)->BOOL,l:LPARAM)->BOOL;
        fn GetMonitorInfoW(m:HMONITOR,info:*mut MONITORINFO)->BOOL;fn GetSystemMetrics(i:i32)->i32;
        fn GetLastInputInfo(info:*mut LASTINPUTINFO)->BOOL;
        fn GetTickCount()->DWORD;
        fn OpenInputDesktop(flags:DWORD,inherit:BOOL,access:DWORD)->HANDLE;fn CloseDesktop(h:HANDLE)->BOOL;
    }
    #[link(name="kernel32")] extern "system"{fn OpenProcess(access:DWORD,inherit:BOOL,pid:DWORD)->HANDLE;fn QueryFullProcessImageNameW(h:HANDLE,flags:DWORD,buf:*mut u16,size:*mut DWORD)->BOOL;fn CloseHandle(h:HANDLE)->BOOL;}
    pub struct Raw {pub monitors:Vec<MonitorInfo>,pub windows:Vec<DesktopWindow>,pub cursor:Point,pub cursor_buttons:u32,pub foreground_app:Option<String>,pub fullscreen:bool,pub idle_seconds:f64,pub locked:bool}
    fn rect(r:RECT)->Rect{Rect{x:r.left as f64,y:r.top as f64,width:(r.right-r.left).max(0) as f64,height:(r.bottom-r.top).max(0) as f64}}
    fn input_idle_seconds()->f64{unsafe{let mut info=LASTINPUTINFO{cb_size:size_of::<LASTINPUTINFO>() as u32,dw_time:0};if GetLastInputInfo(&mut info)==0{return 0.0}let idle=GetTickCount().wrapping_sub(info.dw_time);idle as f64/1000.0}}
    fn workstation_locked()->bool{unsafe{let h=OpenInputDesktop(0,0,DESKTOP_SWITCHDESKTOP);if h==0{return true}CloseDesktop(h);false}}
    unsafe fn title(h:HWND)->String{let n=GetWindowTextLengthW(h);if n<=0{return String::new()}let mut b=vec![0u16;n as usize+1];let got=GetWindowTextW(h,b.as_mut_ptr(),b.len() as i32);String::from_utf16_lossy(&b[..got.max(0) as usize])}
    unsafe fn process_name(h:HWND)->String{let mut pid=0;GetWindowThreadProcessId(h,&mut pid);if pid==0{return String::new()}let ph=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION,0,pid);if ph==0{return String::new()}let mut b=vec![0u16;1024];let mut n=b.len() as u32;let ok=QueryFullProcessImageNameW(ph,0,b.as_mut_ptr(),&mut n);CloseHandle(ph);if ok==0{return String::new()}let full=String::from_utf16_lossy(&b[..n as usize]);full.rsplit(|c| c == '\\' || c == '/').next().unwrap_or(&full).to_string()}
    unsafe extern "system" fn monitor_cb(m:HMONITOR,_:isize,_:*mut RECT,l:LPARAM)->BOOL{let out=&mut *(l as *mut Vec<MonitorInfo>);let mut i=MONITORINFO{cb_size:size_of::<MONITORINFO>() as u32,rc_monitor:RECT{left:0,top:0,right:0,bottom:0},rc_work:RECT{left:0,top:0,right:0,bottom:0},dw_flags:0};if GetMonitorInfoW(m,&mut i)!=0{out.push(MonitorInfo{id:format!("monitor:{m}"),rect:rect(i.rc_monitor),work_area:rect(i.rc_work),primary:(i.dw_flags&MONITORINFOF_PRIMARY)!=0,scale_factor:1.0});}1}
    unsafe extern "system" fn window_cb(h:HWND,l:LPARAM)->BOOL{if IsWindowVisible(h)==0{return 1}if GetWindow(h,GW_OWNER)!=0{return 1}if GetWindowLongPtrW(h,GWL_EXSTYLE)&WS_EX_TOOLWINDOW!=0{return 1}let t=title(h);if t.trim().is_empty(){return 1}let mut r=RECT{left:0,top:0,right:0,bottom:0};if GetWindowRect(h,&mut r)==0{return 1}let rr=rect(r);if rr.width<80.0||rr.height<50.0{return 1}let out=&mut *(l as *mut Vec<DesktopWindow>);out.push(DesktopWindow{id:format!("hwnd:{h}"),title:t,app:process_name(h),rect:rr,visible:true,foreground:false,minimized:IsIconic(h)!=0});1}
    pub fn snapshot()->Raw{unsafe{let mut monitors:Vec<MonitorInfo>=Vec::new();EnumDisplayMonitors(0,std::ptr::null(),monitor_cb,&mut monitors as *mut _ as LPARAM);let mut windows:Vec<DesktopWindow>=Vec::new();EnumWindows(window_cb,&mut windows as *mut _ as LPARAM);let fg=GetForegroundWindow();for w in &mut windows{w.foreground=w.id==format!("hwnd:{fg}");}let mut p=POINT{x:0,y:0};GetCursorPos(&mut p);let cursor=Point{x:p.x as f64,y:p.y as f64};let mut buttons=0;if GetAsyncKeyState(1)<0{buttons|=1}if GetAsyncKeyState(2)<0{buttons|=2}let fg_app=windows.iter().find(|w|w.foreground).map(|w|w.app.clone()).filter(|s|!s.is_empty());let fullscreen=windows.iter().find(|w|w.foreground).map(|w|monitors.iter().any(|m|w.rect.width>=m.rect.width*0.97&&w.rect.height>=m.rect.height*0.94)).unwrap_or(false);let locked=workstation_locked();Raw{monitors,windows,cursor,cursor_buttons:buttons,foreground_app:fg_app,fullscreen,idle_seconds:input_idle_seconds(),locked}}}
    pub fn virtual_bounds()->(i32,i32,i32,i32){unsafe{(GetSystemMetrics(SM_XVIRTUALSCREEN),GetSystemMetrics(SM_YVIRTUALSCREEN),GetSystemMetrics(SM_CXVIRTUALSCREEN),GetSystemMetrics(SM_CYVIRTUALSCREEN))}}
}

#[cfg(not(target_os="windows"))]
mod platform {
    use super::{DesktopWindow,MonitorInfo,Point,Rect};
    pub struct Raw {pub monitors:Vec<MonitorInfo>,pub windows:Vec<DesktopWindow>,pub cursor:Point,pub cursor_buttons:u32,pub foreground_app:Option<String>,pub fullscreen:bool,pub idle_seconds:f64,pub locked:bool}
    pub fn snapshot()->Raw{Raw{monitors:vec![MonitorInfo{id:"primary".into(),rect:Rect{x:0.0,y:0.0,width:1280.0,height:800.0},work_area:Rect{x:0.0,y:0.0,width:1280.0,height:760.0},primary:true,scale_factor:1.0}],windows:vec![],cursor:Point{x:640.0,y:400.0},cursor_buttons:0,foreground_app:None,fullscreen:false,idle_seconds:0.0,locked:false}}
    pub fn virtual_bounds()->(i32,i32,i32,i32){(0,0,1280,800)}
}
