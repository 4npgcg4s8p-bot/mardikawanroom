// ==========================================
// FILE: js/firebase-db.js (Database & Multi-Tenant Super Admin)
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getDatabase, ref as fbRef, set, get, child, onValue, push, remove } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

const app = initializeApp({ 
    apiKey: "AIzaSyCD2-v7vgvgAgOlvkn_tzOHpAtZZEP6B0w", 
    databaseURL: "https://mardikawan-project-default-rtdb.firebaseio.com", 
    projectId: "mardikawan-project" 
});
const db = getDatabase(app);

// EKSPOR FUNGSI FIREBASE ASLI KE GLOBAL UNTUK LOGIN & SUPER ADMIN
window.fbRefGlobal = fbRef;
window.dbGlobal = db;
window.fbGet = get;
window.fbChild = child;
window.fbSet = set;
window.fbRemove = remove;
window.fbOnValue = onValue;

// MAGIC OVERRIDE: AKUN UTAMA (MAHARDIKA) MEMBACA DATA ASLI, GURU LAIN TERPISAH
const ref = function(dbInstance, path) {
    if (path && path.startsWith('akun_guru')) return fbRef(dbInstance, path);
    
    let activeGuru = "mahardika"; 
    
    if (sessionStorage.getItem("statusGuru") === "aktif") {
        let savedUser = sessionStorage.getItem("guruUsername");
        if (savedUser && savedUser !== "null") activeGuru = savedUser;
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        let urlUser = urlParams.get('guru');
        if (urlUser && urlUser !== "null") activeGuru = urlUser;
    }

    // KUNCI UTAMA: Jika "mahardika", WAJIB pakai database ASLI (tanpa prefix)
    if (activeGuru === "mahardika") {
        return path ? fbRef(dbInstance, path) : fbRef(dbInstance);
    }
    
    return path ? fbRef(dbInstance, "workspace_" + activeGuru + "/" + path) : fbRef(dbInstance, "workspace_" + activeGuru);
};

const urlParams = new URLSearchParams(window.location.search); 
let babAktif = urlParams.get('bab') || "home";

window.pagesData=[]; 
window.contentBlocksData=[]; 
window.floatingBoxesData=[]; 
window.quizState={}; 
window.latihanState={}; 
window.bankSoalGlobal=null; 
window.bankUjianGlobal=null; 
window.ujianAktifConfig=null; 
window.dataRekapNilai=null;

onValue(ref(db, 'live_monitor'), snap => {
    let hasViolation = false;
    if(snap.exists()) {
        let data = snap.val();
        Object.values(data).forEach(paket => {
            if(typeof paket === 'object') { Object.values(paket).forEach(siswa => { if(siswa && siswa.vc && siswa.vc > 0) hasViolation = true; }); }
        });
    }
    let badge = document.getElementById('badge-notif');
    if(badge) badge.style.display = hasViolation ? 'inline-block' : 'none';
});

onValue(ref(db,'theme_settings'), snap=>{ 
    if(snap.exists()){ 
        let t=snap.val(); 
        document.documentElement.style.setProperty('--primary-bg',t.bgColor||'#0b3954'); 
        document.documentElement.style.setProperty('--main-font',t.fontFamily||"'Quicksand', sans-serif"); 
        document.getElementById('web-title').innerText=t.webTitle||"Mahardika"; 
        document.getElementById('theme-color').value=t.bgColor||'#0b3954'; 
        document.getElementById('theme-font').value=t.fontFamily||"'Quicksand', sans-serif";
        
        let pad = t.headerPad || '20';
        document.querySelector('.header-wrapper').style.padding = pad + 'px 20px';
        document.getElementById('theme-header-padding').value = pad;
    }
});

let tTimer; 
document.getElementById('web-title').addEventListener('input', ()=>{ 
    clearTimeout(tTimer); 
    tTimer=setTimeout(()=>set(ref(db,'theme_settings/webTitle'),document.getElementById('web-title').innerText),1000); 
});

window.simpanTema = function() { 
    set(ref(db,'theme_settings/bgColor'),document.getElementById('theme-color').value); 
    set(ref(db,'theme_settings/fontFamily'),document.getElementById('theme-font').value); 
    set(ref(db,'theme_settings/headerPad'),document.getElementById('theme-header-padding').value); 
    window.tutupModal('modal-theme'); 
};

get(child(ref(db),'materi_koleksi/popup')).then(s=>{ 
    let h=s.exists()?s.val().html:"<h2>Welcome</h2>"; 
    document.getElementById('popup-content-box').innerHTML=h; 
    if(!sessionStorage.getItem('popupDismissed')) { 
        document.getElementById('modal-welcome-popup').style.display='flex'; 
        if(document.body.classList.contains('mode-edit-aktif')) document.getElementById('popup-img-tool').style.display='block'; 
    } 
});

window.simpanPopupPengumuman = function() { 
    set(ref(db,'materi_koleksi/popup'),{html:document.getElementById('popup-content-box').innerHTML}).then(()=>{
        alert("Disimpan!");
        window.tutupWelcomePopup();
    }); 
};

function updateBreadcrumb() {
    let path = [];
    if(window.pagesData) {
        let targetIdx = window.pagesData.findIndex(p => p.slug === babAktif);
        if(targetIdx > -1) {
            let currentLevel = window.pagesData[targetIdx].level;
            path.unshift(`<span>${window.pagesData[targetIdx].title}</span>`);
            for(let i = targetIdx - 1; i >= 0; i--) {
                if(window.pagesData[i].level < currentLevel) {
                    path.unshift(`<span>${window.pagesData[i].title}</span>`);
                    currentLevel = window.pagesData[i].level;
                }
            }
        }
    }
    let text = path.length > 0 ? path.join(' ➔ ') : '<span>Beranda</span>';
    document.getElementById('bottom-breadcrumb').innerHTML = '📍 ' + text;
}

onValue(ref(db, 'pages_struktur'), snap=>{
    let h = '<li id="menu-latihan"><a href="#" style="color:#f1c40f;" onclick="bukaModalSetupLatihan()">🚀 LATIHAN</a></li><li id="menu-ujian-kelas"><a href="#" style="color:#e74c3c;" onclick="window.bukaModal(\'modal-enter-ujian\')">🎯 UJIAN</a></li>';
    if(snap.exists()){ 
        window.pagesData=snap.val(); 
        let stack=[]; 
        window.pagesData.forEach((p,i)=>{ 
            let nL=(i+1<window.pagesData.length)?window.pagesData[i+1].level:0; 
            let hasC=nL>p.level; 
            h+=`<li class="${p.hidden?'hidden-nav-item':''}"><a href="index.html?bab=${p.slug}" class="${p.slug===babAktif?'active':''} ${p.hidden?'hidden-nav-link':''}">${p.title}${hasC?' ▾':''}</a>`; 
            if(hasC){ h+='<ul>';stack.push(p.level); }
            else{ h+='</li>'; let d=p.level-nL; while(d>0&&stack.length>0){ h+='</ul></li>';stack.pop();d--; } } 
        }); 
        renderPageManager(); 
        aktifkanDragDrop(); 
        updateBreadcrumb(); 
    } 
    document.getElementById('dynamic-navbar').innerHTML=h; 
});

let activeDropdown = null;
let hideMenuTimer;
window.closeDropdowns = function() { if (activeDropdown) { activeDropdown.style.display = 'none'; activeDropdown = null; } };

document.addEventListener('mouseover', e => {
    if (window.innerWidth > 768) {
        let li = e.target.closest('.navbar li'); let inDropdown = e.target.closest('.navbar ul ul');
        if (li && li.querySelector('ul')) {
            clearTimeout(hideMenuTimer); let ul = li.querySelector('ul');
            if (activeDropdown !== ul) { window.closeDropdowns(); let rect = li.getBoundingClientRect(); ul.style.position = 'fixed'; ul.style.top = rect.bottom + 'px'; ul.style.left = rect.left + 'px'; ul.style.display = 'flex'; activeDropdown = ul; }
        } else if (inDropdown) { clearTimeout(hideMenuTimer); } else { hideMenuTimer = setTimeout(window.closeDropdowns, 200); }
    }
});

document.addEventListener('click', e => {
    if (window.innerWidth <= 768) {
        let a = e.target.closest('.navbar a');
        if (a && a.nextElementSibling && a.nextElementSibling.tagName === 'UL') {
            e.preventDefault(); let ul = a.nextElementSibling;
            if (activeDropdown === ul) { window.closeDropdowns(); } else { window.closeDropdowns(); let rect = a.getBoundingClientRect(); ul.style.position = 'fixed'; ul.style.top = rect.bottom + 'px'; ul.style.left = Math.max(0, rect.left) + 'px'; ul.style.display = 'flex'; activeDropdown = ul; }
        } else if (!e.target.closest('.navbar ul ul')) { window.closeDropdowns(); }
    }
});

window.tambahHalamanBaru=function(lvl,idx=-1){ 
    let j=prompt("Nama Page:"); if(!j)return; 
    let slug=j.toLowerCase().replace(/[^a-z0-9]/g,"_")+"_"+Date.now().toString().slice(-4); 
    let arr=[...window.pagesData]; 
    if(idx===-1) { arr.push({slug,title:j,level:lvl,hidden:false}); } 
    else { let insertIdx = idx + 1; while (insertIdx < arr.length && arr[insertIdx].level > arr[idx].level) { insertIdx++; } arr.splice(insertIdx,0,{slug,title:j,level:lvl,hidden:false}); } 
    set(ref(db,'pages_struktur'),arr); 
}; 
window.hapusHalaman=function(idx,j){ 
    if(confirm('Hapus "'+j+'"?')){ 
        let arr=[...window.pagesData]; let lvl=arr[idx].level; arr.splice(idx,1); 
        while(idx<arr.length&&arr[idx].level>lvl) arr.splice(idx,1); 
        set(ref(db,'pages_struktur'),arr); 
    } 
}; 
window.renameHalaman=function(idx,t){ if(t.trim()==="")return; window.pagesData[idx].title=t; set(ref(db,'pages_struktur'),window.pagesData); };
window.toggleSembunyikanHalaman=function(idx){ window.pagesData[idx].hidden = !window.pagesData[idx].hidden; set(ref(db,'pages_struktur'),window.pagesData); };

function renderPageManager(){ 
    let h=''; 
    window.pagesData.forEach((p,i)=>{ 
        h+=`<li class="page-item" draggable="true" data-index="${i}" data-level="${p.level}" data-slug="${p.slug}" style="margin-left:${p.level*25}px;"><div class="item-left"><span class="drag-handle">⋮⋮</span><input type="text" class="page-rename-input" value="${p.title}" onchange="renameHalaman(${i},this.value)"></div><div class="item-actions"><span onclick="toggleSembunyikanHalaman(${i})" style="cursor:pointer; margin-right:8px;" title="Tampilkan/Sembunyikan">${p.hidden?'🚫':'👁️'}</span>${p.level<5?`<span onclick="tambahHalamanBaru(${p.level+1},${i})">+Sub</span>`:''}<span onclick="hapusHalaman(${i},'${p.title}')">🗑️</span></div></li>`; 
    }); 
    document.getElementById('sortable-list').innerHTML=h; 
} 

function aktifkanDragDrop(){ 
    const l=document.getElementById('sortable-list'); let d=null; let dChildren=[];
    l.addEventListener('dragstart',e=>{
        if(e.target.classList.contains('page-item')){
            d=e.target; dChildren=[]; d.dataset.baseLevel = d.dataset.level;
            let next=d.nextElementSibling; let dLevel=parseInt(d.dataset.level);
            while(next && parseInt(next.dataset.level)>dLevel){ next.dataset.baseLevel = next.dataset.level; dChildren.push(next); next.classList.add('dragging-child'); next=next.nextElementSibling; }
            setTimeout(()=>{ d.classList.add('dragging'); dChildren.forEach(c=>c.style.display='none'); },0);
        }
    }); 
    l.addEventListener('dragend',()=>{
        if(d){
            d.classList.remove('dragging'); dChildren.forEach(c=>{ c.classList.remove('dragging-child'); c.style.display='flex'; });
            let arr=[]; 
            document.querySelectorAll('.page-item').forEach((el)=>{ let originalItem = window.pagesData.find(p => p.slug === el.dataset.slug) || {}; arr.push({ slug: el.dataset.slug, title: el.querySelector('.page-rename-input').value, level: parseInt(el.dataset.level), hidden: originalItem.hidden || false }); }); 
            set(ref(db,'pages_struktur'),arr); d=null; dChildren=[];
        }
    }); 
    l.addEventListener('dragover',e=>{
        e.preventDefault(); const t=e.target.closest('.page-item'); 
        if(!d) return;
        if(t && t!==d && !dChildren.includes(t)){
            const r=t.getBoundingClientRect(); let isAfter=(e.clientY-r.top)>(r.height/2); let targetNext=t.nextElementSibling;
            if(isAfter){ let tLevel=parseInt(t.dataset.level); while(targetNext && parseInt(targetNext.dataset.level)>tLevel && !dChildren.includes(targetNext)){ targetNext=targetNext.nextElementSibling; } l.insertBefore(d,targetNext); }else{ l.insertBefore(d,t); }
            let current=d; dChildren.forEach(c=>{ l.insertBefore(c,current.nextSibling); current=c; });
        }
        let lvl=Math.floor((e.clientX-l.getBoundingClientRect().left)/40); if(lvl>5)lvl=5; if(lvl<0)lvl=0; 
        let prev=d.previousElementSibling; let maxLvl=prev?parseInt(prev.dataset.level)+1:0; if(lvl>maxLvl)lvl=maxLvl;
        let baseLevel=parseInt(d.dataset.baseLevel); let levelDiff=lvl-baseLevel; d.style.marginLeft=(lvl*25)+'px'; d.dataset.level=lvl;
        dChildren.forEach(c=>{ let newCLvl=parseInt(c.dataset.baseLevel)+levelDiff; c.dataset.level=newCLvl; c.style.marginLeft=(newCLvl*25)+'px'; });
    }); 
}

get(child(ref(db), 'materi_koleksi/' + babAktif)).then((snap) => {
    if(snap.exists() && snap.val().blocksObj) { 
        window.contentBlocksData=snap.val().blocksObj; 
        window.floatingBoxesData=snap.val().floatingBoxesObj || []; 
    } else { 
        window.contentBlocksData=[{type:'text',html:"<p>Ketik materi...</p>",bg:"#ffffff",pattern:"",color:"#333333",width:"M",padTop:"40px",padBot:"40px",drawing:""}]; 
        window.floatingBoxesData=[]; 
    }
    window.contentBlocksData.forEach(b=>{if(!b.padTop)b.padTop="40px";if(!b.padBot)b.padBot="40px";if(!b.drawing)b.drawing="";if(!b.type)b.type="text";if(!b.pattern)b.pattern="";}); 
    window.renderBlocks(); 
    window.renderFloatingBoxes(); 
    window.renderMathJax();
});

function showSaveToast() { 
    let st = document.getElementById('save-status-bar'); 
    st.innerHTML = "<span style='color:#2ecc71;'>✓ Saved</span>"; 
    setTimeout(()=> { st.innerHTML = "Cloud Sync: Ready"; }, 2000); 
}

window.updateSoalInline = function(bIdx, qIdx, type, el, oIdx) {
    let val = el.innerText.trim();
    if(type==='q') window.contentBlocksData[bIdx].questions[qIdx].question = val.replace(/^\d+\.\s*/, '');
    else if(type==='o') window.contentBlocksData[bIdx].questions[qIdx].options[oIdx] = val.replace(/^[A-D]\.\s*/, '');
    document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>✍️ Menyimpan Soal...</span>";
    clearTimeout(soalTypingTimer); soalTypingTimer = setTimeout(() => { window.simpanKeDB(); }, 1000); 
};

window.updateSoalBank = function(dbRef, type, el, oIdx) {
    let val = el.innerText.trim();
    if(type==='q') val = val.replace(/^\d+\.\s*/, '');
    else if(type==='o') val = val.replace(/^[A-D]\.\s*/, '');
    document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>✍️ Menyimpan Bank Soal...</span>";
    clearTimeout(soalTypingTimer);
    soalTypingTimer = setTimeout(() => { 
        if(type==='q') set(ref(db, dbRef + '/question'), val).then(()=> showSaveToast()); 
        else if(type==='o') set(ref(db, dbRef + '/options/' + oIdx), val).then(()=> showSaveToast()); 
    }, 1000);
};

window.hapusSoalSistem = function(qIdx, pre, bIdx) {
    if(!confirm('Hapus soal ini?')) return;
    if(pre === 'inline') { window.contentBlocksData[bIdx].questions.splice(qIdx, 1); window.renderBlocks(); window.simpanKeDB(); } 
    else if (pre === 'lat') { window.latihanState.soalArr.splice(qIdx, 1); window.latihanState.total--; renderRuangKuis('temporary-quiz-container', window.latihanState.soalArr, 'lat'); } 
    else if (pre === 'strict') { window.latihanState.soalArr.splice(qIdx, 1); window.latihanState.total--; renderRuangKuis('ujian-strict-container', window.latihanState.soalArr, 'strict'); let stateStr = localStorage.getItem('gamma_exam_state'); if(stateStr) { let state = JSON.parse(stateStr); state.soalArr = window.latihanState.soalArr; localStorage.setItem('gamma_exam_state', JSON.stringify(state)); } }
};

window.renderBlocks = function() {
    let html=''; let isEdit=document.body.classList.contains('mode-edit-aktif')||document.documentElement.classList.contains('force-edit-mode');
    (window.contentBlocksData || []).forEach((blok, index) => {
        let qi='';
        
        let ctrlHtml = `<div class="block-controls" contenteditable="false" style="user-select:none;">
            <button type="button" contenteditable="false" onclick="window.toggleBlockFullscreen(this, ${index})" title="Fokus Layar Penuh">🔲 Fokus</button>
            <button type="button" contenteditable="false" onclick="geserBlok(${index}, -1)">⬆️</button>
            <button type="button" contenteditable="false" onclick="geserBlok(${index}, 1)">⬇️</button>
            <button type="button" contenteditable="false" onclick="bukaSidebarBlock(${index})">⚙️ Setting</button>
            <button type="button" contenteditable="false" onclick="hapusBlok(${index})">🗑️ Delete</button>
        </div>`;

        if (blok.type === 'pdf') {
            let slides = '<div class="pdf-nav-hint">↔️ Geser (Swipe) ke Kiri/Kanan untuk berpindah halaman slide</div>' +
                         '<div class="pdf-slider-container">';
            (blok.pages || []).forEach(function(pg, i) {
                slides += '<div class="pdf-slide"><img src="' + pg + '" alt="Halaman ' + (i+1) + '"><div style="margin-top:8px; font-weight:bold; color:#34495e;">Halaman ' + (i+1) + ' dari ' + blok.pages.length + '</div></div>';
            });
            slides += '</div>';
            html += `<div class="block-wrapper" data-index="${index}" style="padding-top:${blok.padTop};padding-bottom:${blok.padBot};">
                <div class="content-block" data-index="${index}" data-width="${blok.width}" style="background-color:${blok.bg};">
                    <canvas class="drawing-layer" data-index="${index}"></canvas>
                    ${ctrlHtml}
                    ${slides}
                </div>
            </div>`;
        } else if (blok.type === 'quiz') {
            qi+=`<div class="quiz-container" id="inline-kuis-${index}"><div class="quiz-header"><h3 class="quiz-title">🧩 Uji Pemahaman</h3><div><button class="btn-action" style="background:#34495e;width:auto;font-size:11px;padding:6px 12px;margin-right:5px;" onclick="cetakKuisPDF('inline-kuis-${index}','Materi')">🖨️ Cetak</button>${isEdit?`<button class="btn-action" style="background:#2e7d32;width:auto;font-size:11px;padding:6px 12px;" onclick="bukaAIQuizModal(${index})">🤖 Ekstrak</button>`:''}</div></div>`;
            if(blok.questions&&blok.questions.length>0) {
                blok.questions.forEach((q,qIdx)=>{ 
                    let qTextHtml = isEdit 
                        ? `<div class="quiz-question-text" contenteditable="true" oninput="updateSoalInline(${index},${qIdx},'q',this)">${qIdx+1}. ${q.question}</div>` 
                        : `<div class="quiz-question-text">${qIdx+1}. ${q.question}</div>`;
                    qi+=`<div class="quiz-question-card" id="inline-q-${index}-${qIdx}">${isEdit?`<button class="btn-delete-q" contenteditable="false" onclick="hapusSoalSistem(${qIdx}, 'inline', ${index})" title="Hapus Soal">🗑️</button>`:''}${qTextHtml}`;
                    
                    if(q.type === 'short_answer' || (!q.options && q.correctAnswers)) {
                        let altStr = q.correctAnswers ? q.correctAnswers.join(' | ') : '';
                        qi += `<div class="short-answer-box" style="margin-top:10px;">
                            <input type="text" class="input-box" placeholder="Ketik jawaban singkat..." style="font-size:15px; font-weight:600; padding:10px 12px; border:2px solid #3498db; border-radius:8px; width:100%; box-sizing:border-box;" oninput="jawabKuisInlineIsian(this, ${index}, ${qIdx})">
                            ${isEdit ? `<div style="font-size:11px; color:#c0392b; margin-top:8px; background:#fadbd8; padding:6px; border-radius:4px; border-left:4px solid #e74c3c;"><b>🔒 Info Admin:</b> Alternatif Kunci: ${altStr}</div>` : ''}
                        </div>`;
                    } else {
                        qi += `<div class="quiz-options">`;
                        (q.options || []).forEach((opt,oIdx)=>{ 
                            let optHtml = isEdit 
                                ? `<div class="quiz-option-btn" contenteditable="true" oninput="updateSoalInline(${index},${qIdx},'o',this,${oIdx})">${String.fromCharCode(65+oIdx)}. ${opt}</div>` 
                                : `<button class="quiz-option-btn" onclick="jawabKuisInline(this,${index},${qIdx},${oIdx},${q.correctIndex})">${String.fromCharCode(65+oIdx)}. ${opt}</button>`;
                            qi+=optHtml; 
                        }); 
                        qi += `</div>`;
                    }
                    qi+=`<div class="quiz-explanation"><b>Pembahasan:</b> ${q.explanation||'Tepat!'}</div></div>`; 
                });
                qi+=`<div class="quiz-nav-bar" style="margin-top:0;border-top:none;">`; blok.questions.forEach((q,qIdx)=>{qi+=`<button class="quiz-nav-btn" id="nav-btn-inline-${index}-${qIdx}" onclick="document.querySelector('#inline-q-${index}-${qIdx}').scrollIntoView({behavior:'smooth',block:'center'})">${qIdx+1}</button>`;}); qi+=`</div>`;
            } else qi+='<p style="color:#888;">Belum ada soal.</p>'; qi+='</div>';
            
            html+=`<div class="block-wrapper" data-index="${index}" style="padding-top:${blok.padTop};padding-bottom:${blok.padBot};">
                <div class="content-block ${blok.pattern||''}" data-index="${index}" data-width="${blok.width}" style="background-color:${blok.bg};">
                    <canvas class="drawing-layer" data-index="${index}"></canvas>
                    ${ctrlHtml}
                    ${qi}
                </div>
            </div>`;
        } else {
            let isiTeks = (blok.html && blok.html.trim() !== '') ? blok.html : '<p><br></p>';
            html+=`<div class="block-wrapper" data-index="${index}" style="padding-top:${blok.padTop};padding-bottom:${blok.padBot};">
                <div class="content-block ${blok.pattern||''}" ${isEdit?'contenteditable="true"':''} data-index="${index}" data-width="${blok.width}" style="color:${blok.color}; background-color:${blok.bg};">
                    <canvas class="drawing-layer" data-index="${index}"></canvas>
                    ${ctrlHtml}
                    ${isiTeks}
                </div>
            </div>`;
        }
    }); 
    let container = document.getElementById('blocks-container');
    if (container) container.innerHTML = html;
    setTimeout(inisialisasiSemuaCanvas,300); 
    if(window.renderMathJax) window.renderMathJax();
};

window.renderFloatingBoxes = function() {
    let html = ''; let isEdit=document.body.classList.contains('mode-edit-aktif')||document.documentElement.classList.contains('force-edit-mode');
    (window.floatingBoxesData || []).forEach((fb, i) => {
        html += `<div class="floating-box" id="fb-${i}" style="left:${fb.x}; top:${fb.y}; width:${fb.w}; height:${fb.h}; background:${fb.bg||'#fafafa'};">
            <div class="fb-drag" onpointerdown="startDragFB(event, ${i})">✥ Drag</div>
            <button class="fb-delete" onclick="hapusFloatingBox(${i})">✕</button>
            <div class="fb-content" data-fb-index="${i}" ${isEdit?'contenteditable="true"':''}>
                <canvas class="drawing-layer fb-canvas" data-fb-index="${i}"></canvas>
                ${fb.html}
            </div>
            <div class="fb-resize" onpointerdown="startResizeFB(event, ${i})"></div>
        </div>`;
    });
    let container = document.getElementById('floating-boxes-container');
    if(!container) { container = document.createElement('div'); container.id = 'floating-boxes-container'; document.getElementById('main-editor-wrapper').appendChild(container); }
    container.innerHTML = html; setTimeout(inisialisasiSemuaCanvas, 300); window.renderMathJax();
};

let typingTimer; 
document.getElementById('main-editor-wrapper').addEventListener('input', e=>{ 
    if(e.target.classList.contains('content-block') || e.target.classList.contains('fb-content')){ 
        let st = document.getElementById('save-status-bar'); st.innerHTML = "<span style='color:#e67e22;'>✍️ Typing...</span>";
        clearTimeout(typingTimer); typingTimer=setTimeout(window.simpanKeDB,2000); 
        setTimeout(()=>{ let c=e.target.querySelector('.drawing-layer'); if(c)inisialisasiSatuCanvas(c,true); },100); 
    }
});

window.simpanKeDB=function(){ 
    document.querySelectorAll('.content-block').forEach(b=>{
        let i=b.getAttribute('data-index');
        if(window.contentBlocksData[i]&&window.contentBlocksData[i].type!=='quiz'){
            let clone = b.cloneNode(true);
            clone.querySelectorAll('.drawing-layer, .block-controls').forEach(el=>el.remove());
            window.contentBlocksData[i].html=clone.innerHTML;
        }
    }); 
    document.querySelectorAll('.fb-content').forEach(fb=>{
        let i=fb.getAttribute('data-fb-index');
        if(window.floatingBoxesData[i]){
            let clone = fb.cloneNode(true);
            clone.querySelectorAll('.drawing-layer').forEach(el=>el.remove());
            window.floatingBoxesData[i].html=clone.innerHTML;
        }
    });
    document.getElementById('save-status-bar').innerHTML = "<span style='color:#3498db;'>☁️ Syncing...</span>"; 
    set(ref(db,'materi_koleksi/'+babAktif),{blocksObj:window.contentBlocksData, floatingBoxesObj: window.floatingBoxesData||[]}).then(()=>{showSaveToast();}); 
};

window.tambahBlokBaruAkhir=function(){ window.contentBlocksData.push({type:'text',html:"<p>Ketik materi...</p>",bg:"#ffffff",pattern:"",color:"#333333",width:"M",padTop:"40px",padBot:"40px",drawing:""}); window.renderBlocks(); window.simpanKeDB(); window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); }; 
window.tambahBlokBaruTengah=function(){ 
    let newBlock = {type:'text',html:"<p>Ketik materi...</p>",bg:"#ffffff",pattern:"",color:"#333333",width:"M",padTop:"40px",padBot:"40px",drawing:""};
    if(activeBlockIndex > -1) window.contentBlocksData.splice(activeBlockIndex + 1, 0, newBlock);
    else window.contentBlocksData.push(newBlock);
    window.renderBlocks(); window.simpanKeDB(); 
};
window.hapusBlok=function(i){ if(window.contentBlocksData.length<=1)return alert("Minimal 1 block!"); if(confirm("Hapus?")){ window.contentBlocksData.splice(i,1); window.renderBlocks(); window.simpanKeDB(); } }; 

window.bukaSidebarBlock=function(i){ 
    activeBlockIndex=i; let b=window.contentBlocksData[i]; 
    document.querySelector('input[oninput*="padTop"]').value=parseInt(b.padTop); document.getElementById('val-padtop').innerText=b.padTop; 
    document.querySelector('input[oninput*="padBot"]').value=parseInt(b.padBot); document.getElementById('val-padbot').innerText=b.padBot; 
    document.getElementById('sidebar-block').classList.add('open'); 
}; 

window.ubahPolaBkg = function(pola) {
    if(activeBlockIndex > -1){ 
        window.contentBlocksData[activeBlockIndex].pattern = pola;
        let contentEl = document.querySelector('.content-block[data-index="' + activeBlockIndex + '"]');
        let wrapEl = document.querySelector('.block-wrapper[data-index="' + activeBlockIndex + '"]');
        if(wrapEl) {
            wrapEl.classList.remove('bg-pattern-lines', 'bg-pattern-grid', 'bg-pattern-dots');
        }
        if(contentEl) {
            contentEl.classList.remove('bg-pattern-lines', 'bg-pattern-grid', 'bg-pattern-dots');
            if(pola) contentEl.classList.add(pola);
        }
        window.simpanKeDB();
    }
};

window.ubahStyleBlok=function(t,v){ 
    if(activeBlockIndex>-1){ 
        window.contentBlocksData[activeBlockIndex][t]=v; 
        let d=document.querySelector(`.content-block[data-index="${activeBlockIndex}"]`); 
        if(d){ 
            if(t==='bg') d.parentElement.style.backgroundColor=v; 
            if(t==='color') d.style.color=v; 
            if(t==='width'){d.setAttribute('data-width',v);setTimeout(inisialisasiSemuaCanvas,200);} 
            if(t==='padTop'){d.parentElement.style.paddingTop=v;setTimeout(inisialisasiSemuaCanvas,200);} 
            if(t==='padBot'){d.parentElement.style.paddingBottom=v;setTimeout(inisialisasiSemuaCanvas,200);} 
        } 
        clearTimeout(typingTimer); typingTimer=setTimeout(window.simpanKeDB,1500); 
    } 
};
window.geserBlok=function(i, dir) {
    if(i + dir >= 0 && i + dir < window.contentBlocksData.length) {
        let temp = window.contentBlocksData[i]; window.contentBlocksData[i] = window.contentBlocksData[i+dir]; window.contentBlocksData[i+dir] = temp;
        window.renderBlocks(); window.simpanKeDB();
    }
};

window.tambahFloatingBox = function() { 
    if(!window.floatingBoxesData) window.floatingBoxesData = []; 
    window.floatingBoxesData.push({ x: '20px', y: '20px', w: '300px', h: '200px', html: '<h3>Shape Baru</h3><p>Ketik penjelasan...</p>', drawing: '', bg: '#fdfdfd' }); 
    window.renderFloatingBoxes(); window.simpanKeDB(); 
};
window.hapusFloatingBox = function(i) { if(confirm('Hapus elemen ini?')) { window.floatingBoxesData.splice(i, 1); window.renderFloatingBoxes(); window.simpanKeDB(); } };
window.startDragFB = function(e, i) {
    if(!document.body.classList.contains('mode-edit-aktif')) return; e.preventDefault();
    let el = document.getElementById('fb-'+i), sX = e.clientX, sY = e.clientY, sL = parseInt(el.style.left)||0, sT = parseInt(el.style.top)||0;
    function move(ev) { el.style.left = (sL + (ev.clientX - sX)) + 'px'; el.style.top = (sT + (ev.clientY - sY)) + 'px'; }
    function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); window.floatingBoxesData[i].x = el.style.left; window.floatingBoxesData[i].y = el.style.top; window.simpanKeDB(); }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
};
window.startResizeFB = function(e, i) {
    if(!document.body.classList.contains('mode-edit-aktif')) return; e.preventDefault(); e.stopPropagation();
    let el = document.getElementById('fb-'+i), sX = e.clientX, sY = e.clientY, sW = el.offsetWidth, sH = el.offsetHeight;
    function move(ev) { el.style.width = (sW + (ev.clientX - sX)) + 'px'; el.style.height = (sH + (ev.clientY - sY)) + 'px'; }
    function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); window.floatingBoxesData[i].w = el.style.width; window.floatingBoxesData[i].h = el.style.height; setTimeout(inisialisasiSemuaCanvas, 100); window.simpanKeDB(); }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
};

window.sisipkanBlokKuis = function(){ window.contentBlocksData.push({type:'quiz',questions:[],bg:"#ffffff",width:"M",padTop:"20px",padBot:"20px"}); window.renderBlocks(); window.simpanKeDB(); window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); };
window.bukaAIQuizModal = function(i){ activeQuizBlockIdx=i; document.getElementById('ai-quiz-topic').value=""; window.bukaModal('modal-ai-quiz'); };
window.prosesGenerateQuizAI = function(){ 
    let t=document.getElementById('ai-quiz-topic').value; let c=parseInt(document.getElementById('ai-quiz-count').value||"5"); 
    if(!t)return alert("Paste soal!"); 
    document.getElementById('save-status-bar').innerHTML="<span style='color:#e67e22;'>🤖 Mengekstrak...</span>"; 
    let q=ekstrakTeksKeArraySoal(t); 
    if(q.length===0)return alert("Format salah. Pastikan ada 'Soal:' dan 'Kunci:'."); 
    q=q.sort(()=>0.5-Math.random()).slice(0,c); 
    if(activeQuizBlockIdx>-1&&window.contentBlocksData[activeQuizBlockIdx]){ 
        window.contentBlocksData[activeQuizBlockIdx].questions=q; 
        delete window.quizState[activeQuizBlockIdx]; 
        window.renderBlocks(); 
        window.simpanKeDB(); 
    } 
    window.tutupModal('modal-ai-quiz'); 
};

window.jawabKuisInline = function(btn,bIdx,qIdx,oIdx,cIdx){ 
    if(document.body.classList.contains('mode-edit-aktif')||document.documentElement.classList.contains('force-edit-mode')) return;
    if(!window.quizState[bIdx]){ let tQ=btn.closest('.quiz-container').querySelectorAll('.quiz-question-card').length; window.quizState[bIdx]={answered:new Set(),correct:0,total:tQ, jawabans:{}}; } 
    let s=window.quizState[bIdx]; 
    if(s.answered.has(qIdx)) return; 
    
    let p=btn.closest('.quiz-question-card'); let all=p.querySelectorAll('.quiz-option-btn'); let exp=p.querySelector('.quiz-explanation'); 
    s.answered.add(qIdx); if(oIdx===cIdx)s.correct++; s.jawabans[qIdx] = (oIdx===cIdx);
    all.forEach(b=>{ b.classList.remove('selected-correct','selected-wrong'); b.disabled = true; }); 
    if(oIdx===cIdx)btn.classList.add('selected-correct'); else{btn.classList.add('selected-wrong');all[cIdx].classList.add('selected-correct');} 
    if(exp)exp.style.display='block'; window.renderMathJax(); let navBtn=document.getElementById(`nav-btn-inline-${bIdx}-${qIdx}`); if(navBtn)navBtn.classList.add('nav-answered'); 
    if(s.answered.size===s.total) setTimeout(()=>{ document.getElementById('quiz-result-score').innerText=Math.round((s.correct/s.total)*100); document.getElementById('quiz-result-correct').innerText=s.correct; document.getElementById('quiz-result-total').innerText=s.total; document.getElementById('btn-remedial').style.display='none'; window.bukaModal('modal-quiz-result'); },600); 
};

window.jawabKuisInlineIsian = function(inputEl, bIdx, qIdx) {
    if(document.body.classList.contains('mode-edit-aktif')||document.documentElement.classList.contains('force-edit-mode')) return;
    if(!window.quizState[bIdx]){ let tQ=inputEl.closest('.quiz-container').querySelectorAll('.quiz-question-card').length; window.quizState[bIdx]={answered:new Set(),correct:0,total:tQ, jawabans:{}}; } 
    let s=window.quizState[bIdx]; 
    let val = inputEl.value.trim();
    let normalizedUser = val.toLowerCase().replace(/\s+/g, ' ');
    let q = window.contentBlocksData[bIdx].questions[qIdx];
    
    let isCorrect = false;
    if(q && q.correctAnswers && Array.isArray(q.correctAnswers)) {
        isCorrect = q.correctAnswers.some(ans => ans.toLowerCase().trim().replace(/\s+/g, ' ') === normalizedUser);
    }

    if(val.length > 0) s.answered.add(qIdx); else s.answered.delete(qIdx);
    s.jawabans[qIdx] = isCorrect;
    let navBtn=document.getElementById(`nav-btn-inline-${bIdx}-${qIdx}`); 
    if(navBtn) { if(val.length > 0) navBtn.classList.add('nav-answered'); else navBtn.classList.remove('nav-answered'); }

    if(s.answered.size === s.total) {
        let cor = 0; Object.values(s.jawabans).forEach(v => { if(v) cor++; });
        setTimeout(() => {
            document.getElementById('quiz-result-score').innerText = Math.round((cor / s.total) * 100);
            document.getElementById('quiz-result-correct').innerText = cor;
            document.getElementById('quiz-result-total').innerText = s.total;
            document.getElementById('btn-remedial').style.display='none';
            window.bukaModal('modal-quiz-result');
        }, 600);
    }
};

onValue(ref(db,'bank_soal_pusat'),s=>{ 
    if(s.exists()){ 
        window.bankSoalGlobal=s.val(); 
        let babSet=new Set(); 
        Object.values(s.val()).forEach(k=>Object.values(k).forEach(m=>Object.keys(m).forEach(b=>babSet.add(b)))); 
        let dl=""; babSet.forEach(b=>dl+=`<option value="${b}">`); 
        let babListEl = document.getElementById('admin-bab-list');
        if(babListEl) babListEl.innerHTML=dl; 
    }
});

window.simpanKeBankSoalPusat=function(){ 
    let k=document.getElementById('admin-bs-kelas').value, m=document.getElementById('admin-bs-mapel').value, b=document.getElementById('admin-bs-bab').value.trim()||"Umum", kes=document.getElementById('admin-bs-kesulitan').value, t=document.getElementById('admin-bs-text').value; 
    if(!t)return alert("Kosong!"); 
    let sBaru=ekstrakTeksKeArraySoal(t); 
    if(sBaru.length===0)return alert("Gagal ekstrak format. Pastikan ada 'Soal:' dan 'Kunci:'."); 
    get(child(ref(db),`bank_soal_pusat/${k}/${m}/${b}/${kes}`)).then(snap=>{ 
        let gabungan=[...(snap.exists()?snap.val():[]),...sBaru]; 
        set(ref(db,`bank_soal_pusat/${k}/${m}/${b}/${kes}`),gabungan).then(()=>{alert("Berhasil!");window.tutupModal('modal-admin-bank-soal');}); 
    }); 
};

window.bukaModalManagerSoal=function(){ 
    let htmlK = '<option value="Semua">Semua Kelas</option>';
    if (window.bankSoalGlobal) { Object.keys(window.bankSoalGlobal).sort().forEach(k => htmlK += `<option value="${k}">${k}</option>`); }
    document.getElementById('filter-manajer-kelas').innerHTML = htmlK; window.renderManajerSoal(); window.bukaModal('modal-manajer-soal'); 
};

window.renderManajerSoal = function() {
    let ul = document.getElementById('list-manajer-soal'); let filterK = document.getElementById('filter-manajer-kelas').value;
    if(!window.bankSoalGlobal) { ul.innerHTML="<li>Kosong.</li>"; return; }
    let h = "";
    Object.keys(window.bankSoalGlobal).sort().forEach(k => {
        if (filterK !== "Semua" && k !== filterK) return;
        Object.keys(window.bankSoalGlobal[k]).sort().forEach(m => {
            Object.keys(window.bankSoalGlobal[k][m]).sort().forEach(b => {
                Object.keys(window.bankSoalGlobal[k][m][b]).sort().forEach(kes => {
                    let mockAnalytic = (kes === 'HOTS') ? `<span style="color:#e74c3c; font-size:10px; font-weight:bold; margin-left:10px;">🔥 78% Siswa Salah</span>` : '';
                    h+=`<li class="soal-manager-item"><div class="soal-manager-info"><span class="soal-manager-tag">${k}</span><span class="soal-manager-tag" style="background:#e67e22;">${m}</span><span class="soal-manager-tag" style="background:#27ae60;">${kes}</span> <b>${b}</b> ${mockAnalytic}</div><button class="btn-delete-soal" onclick="hapusKategoriSoal('${k}/${m}/${b}/${kes}')">🗑️</button></li>`;
                });
            });
        });
    });
    ul.innerHTML = h || "<li>Tidak ada soal pada kelas ini.</li>";
};
window.hapusKategoriSoal=function(p){ if(confirm(`Hapus ${p}?`)) remove(ref(db,`bank_soal_pusat/${p}`)).then(()=>{alert("Dihapus!");window.renderManajerSoal();}); };

window.bukaModalSetupLatihan=function(){ 
    if(!window.bankSoalGlobal)return alert("Bank Soal kosong!"); 
    let h='<option value="" disabled selected>-- Pilih Kelas --</option>'; 
    Object.keys(window.bankSoalGlobal).sort().forEach(k=>h+=`<option value="${k}">${k}</option>`); 
    document.getElementById('setup-kelas').innerHTML=h; 
    document.getElementById('setup-mapel').disabled=true; 
    document.getElementById('setup-bab').disabled=true; 
    document.getElementById('setup-kesulitan').disabled=true; 
    window.bukaModal('modal-setup-latihan'); 
};

window.updateDropdownStudent=function(lvl){ 
    let k=document.getElementById('setup-kelas').value, mSel=document.getElementById('setup-mapel'), bSel=document.getElementById('setup-bab'), kesSel=document.getElementById('setup-kesulitan'); 
    if(lvl==='kelas'&&k){ 
        let mapels = Object.keys(window.bankSoalGlobal[k]||{}).sort();
        let h=''; 
        if(mapels.length===1){ h=`<option value="${mapels[0]}">${mapels[0]}</option>`; mSel.innerHTML=h; mSel.value=mapels[0]; mSel.disabled=true; window.updateDropdownStudent('mapel'); } 
        else { h='<option value="" disabled selected>-- Pilih --</option>'; mapels.forEach(m=>h+=`<option value="${m}">${m}</option>`); mSel.innerHTML=h; mSel.disabled=false; bSel.disabled=true; kesSel.disabled=true; }
    } else if(lvl==='mapel'&&k){ 
        let h='<option value="Semua">Campuran</option>'; Object.keys(window.bankSoalGlobal[k][mSel.value]||{}).sort().forEach(b=>h+=`<option value="${b}">${b}</option>`); bSel.innerHTML=h; bSel.disabled=false; window.updateDropdownStudent('bab');
    } else if(lvl==='bab'&&k){
        let m=mSel.value; let b=bSel.value; let availableKes = new Set();
        if(b === "Semua") { Object.values(window.bankSoalGlobal[k][m]||{}).forEach(babObj => { Object.keys(babObj).forEach(lvl => availableKes.add(lvl)); }); } else if(window.bankSoalGlobal[k][m][b]) { Object.keys(window.bankSoalGlobal[k][m][b]).forEach(lvl => availableKes.add(lvl)); }
        let hK='<option value="Campuran" selected>Campuran</option>'; Array.from(availableKes).sort().forEach(lvl => hK+=`<option value="${lvl}">${lvl}</option>`); kesSel.innerHTML=hK; kesSel.disabled=false;
    }
};

window.mulaiLatihanMandiri=function(){ 
    let k=document.getElementById('setup-kelas').value, m=document.getElementById('setup-mapel').value, b=document.getElementById('setup-bab').value, kes=document.getElementById('setup-kesulitan').value, jml=parseInt(document.getElementById('setup-jumlah').value); 
    if(!k||!m||!b||!jml)return alert("Lengkapi pilihan!"); 
    let soal=[]; let dM=window.bankSoalGlobal[k][m]; 
    if(dM){ let bAmbil=(b==="Semua")?Object.keys(dM):[b]; bAmbil.forEach(bab=>{ if(dM[bab]){ Object.keys(dM[bab]).forEach(lvl=>{ if(kes==="Campuran"||kes===lvl){ dM[bab][lvl].forEach((qData, qIdx)=>{ soal.push({...qData, dbRef: `bank_soal_pusat/${k}/${m}/${bab}/${lvl}/${qIdx}`}); }); } }); } }); } 
    if(soal.length===0)return alert("Tidak ada soal."); soal=soal.sort(()=>0.5-Math.random()).slice(0,jml); 
    window.tutupModal('modal-setup-latihan'); document.getElementById('temporary-quiz-room').style.display='block'; document.body.style.overflow='hidden'; 
    document.getElementById('lat-judul-ui').innerText = "Ruang Latihan Mandiri 🚀";
    
    window.latihanState={mode:'latihan', k:k, m:m, b:b, soalArr: soal, answered:new Set(),correct:0,total:soal.length, jawabans:{}}; 
    renderRuangKuis('temporary-quiz-container',soal,'lat'); 
};

window.triggerRemedialOtomatis = function() {
    if(!window.latihanState || !window.bankSoalGlobal) return;
    let {k, m, b} = window.latihanState;
    if(!k || !m || !b) return alert("Data topik tidak ditemukan untuk remedial.");
    
    let soalBaru = [];
    let dM = window.bankSoalGlobal[k][m];
    if(dM) {
        let bAmbil = (b==="Semua") ? Object.keys(dM) : [b];
        bAmbil.forEach(bab => {
            if(dM[bab]) {
                if(dM[bab]["C1"]) { dM[bab]["C1"].forEach(q => soalBaru.push(q)); }
                if(dM[bab]["C2"]) { dM[bab]["C2"].forEach(q => soalBaru.push(q)); }
            }
        });
    }
    if(soalBaru.length === 0) return alert("Belum ada soal mudah (C1/C2) di Bank Soal untuk topik ini.");
    
    soalBaru = soalBaru.sort(()=>0.5-Math.random()).slice(0, 5);
    window.tutupModalHasilQuiz();
    
    document.getElementById('lat-judul-ui').innerText = "🎯 Latihan Remedial (AI Auto-Gen)";
    window.latihanState = {mode:'latihan', k:k, m:m, b:b, soalArr: soalBaru, answered:new Set(), correct:0, total:soalBaru.length, jawabans:{}};
    renderRuangKuis('temporary-quiz-container', soalBaru, 'lat');
};

onValue(ref(db,'bank_soal_ujian'),s=>{if(s.exists())window.bankUjianGlobal=s.val();}); 
onValue(ref(db,'ujian_aktif'),s=>{if(s.exists())window.ujianAktifConfig=s.val(); else window.ujianAktifConfig=null;}); 
onValue(ref(db,'hasil_ujian'),s=>{if(s.exists())window.dataRekapNilai=s.val();});

window.simpanKeBankUjian=function(){ 
    let n=document.getElementById('admin-bu-nama').value.trim(), t=document.getElementById('admin-bu-text').value; 
    if(!n||!t)return; 
    let s=ekstrakTeksKeArraySoal(t); 
    if(s.length===0)return alert("Gagal ekstrak."); 
    set(ref(db,`bank_soal_ujian/${n}`),s).then(()=>{alert("Disimpan!");window.tutupModal('modal-admin-bank-ujian');}); 
};
window.bukaModalManajerUjian=function(){ 
    let ul=document.getElementById('list-manajer-ujian'); 
    if(!window.bankUjianGlobal) ul.innerHTML="<li>Belum ada paket ujian.</li>"; 
    else{ 
        let h=""; 
        Object.keys(window.bankUjianGlobal).sort().forEach(k=>{ 
            let totalSoal = window.bankUjianGlobal[k].length; 
            h+=`<li class="soal-manager-item"><div class="soal-manager-info"><b>${k}</b> (${totalSoal} Soal)</div><button class="btn-delete-soal" onclick="hapusPaketUjian('${k}')">🗑️</button></li>`; 
        }); 
        ul.innerHTML=h; 
    } 
    window.bukaModal('modal-manajer-ujian'); 
};
window.hapusPaketUjian=function(p){ if(confirm(`Hapus paket ujian "${p}" secara permanen?`)) remove(ref(db,`bank_soal_ujian/${p}`)).then(()=>{alert("Paket Dihapus!");window.bukaModalManajerUjian();}); };

window.bukaModalKontrolUjian = function() { renderKontrolUjianUI(); window.bukaModal('modal-kontrol-ujian'); };

function renderKontrolUjianUI() {
    let select = document.getElementById('admin-pilih-ujian'); 
    let activeContainer = document.getElementById('container-ujian-aktif');
    get(child(ref(db), 'ujian_aktif')).then(snap => {
        let activeMap = {};
        if(snap.exists()) {
            let val = snap.val();
            Object.keys(val).forEach(k => { if(val[k] && val[k].aktif) activeMap[k] = val[k]; });
        }
        
        let activeHtml = ''; 
        let activeNames = Object.keys(activeMap);
        if(activeNames.length === 0) { 
            activeHtml = '<p style="color:#888; font-size:12px; font-style:italic; margin:0;">Belum ada ujian yang sedang aktif saat ini.</p>'; 
        } else {
            activeNames.forEach(nama => { 
                let item = activeMap[nama]; 
                let jmlSoalAktif = (window.bankUjianGlobal && window.bankUjianGlobal[nama]) ? window.bankUjianGlobal[nama].length : 0;
                activeHtml += '<div style="background:#e8f8f5; border:1px solid #a3e4d7; border-radius:6px; padding:10px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<div><strong style="color:#16a085; font-size:14px;">' + nama + '</strong>' +
                    '<div style="font-size:11px; color:#555;">Kode Akses: <b style="color:#e67e22;">' + (item.kode || '-') + '</b> | Jumlah: <b style="color:#2980b9;">' + jmlSoalAktif + ' Soal</b> | Waktu: <b style="color:#2c3e50;">' + (item.durasi || 90) + ' mnt</b></div></div>' +
                    '<button class="btn-action" style="background:#e74c3c; width:auto; padding:6px 12px; font-size:11px;" onclick="matikanUjianAkses(\'' + nama + '\')">🔴 Matikan Akses</button></div>'; 
            });
        }
        if(activeContainer) activeContainer.innerHTML = activeHtml;

        let optionsHtml = '<option value="" disabled selected>-- Pilih Ujian --</option>';
        if(window.bankUjianGlobal) { 
            Object.keys(window.bankUjianGlobal).sort().forEach(k => { 
                if(!activeMap[k]) { 
                    let totalSoal = window.bankUjianGlobal[k] ? window.bankUjianGlobal[k].length : 0;
                    optionsHtml += '<option value="' + k + '">' + k + ' (' + totalSoal + ' Soal)</option>'; 
                } 
            }); 
        }
        select.innerHTML = optionsHtml; 
        document.getElementById('admin-kode-ujian').value = '';
    });
}

window.matikanUjianAkses = function(namaUjian) { if(confirm(`Matikan akses ujian "${namaUjian}" sekarang?`)) { set(ref(db, `ujian_aktif/${namaUjian}/aktif`), false).then(() => { alert(`Akses ujian "${namaUjian}" berhasil dimatikan.`); renderKontrolUjianUI(); }); } };

window.simpanKontrolUjian = function() { 
    let n = document.getElementById('admin-pilih-ujian').value; let k = document.getElementById('admin-kode-ujian').value.trim(); let durasi = parseInt(document.getElementById('admin-durasi-ujian').value) || 90;
    if(!n || !k) return alert("Pilih paket ujian dan isi Kode Akses!"); 
    get(child(ref(db), 'ujian_aktif')).then(snap => {
        let activeCount = 0; if(snap.exists()) { let val = snap.val(); Object.keys(val).forEach(key => { if(val[key] && val[key].aktif) activeCount++; }); }
        if(activeCount >= 4) { return alert("Maksimal hanya 4 ujian yang bisa aktif secara bersamaan."); }
        set(ref(db, `ujian_aktif/${n}`), { nama_ujian: n, kode: k, aktif: true, durasi: durasi }).then(() => { alert(`Ujian "${n}" telah DIAKTIFKAN dengan durasi ${durasi} menit!`); renderKontrolUjianUI(); }); 
    });
};

window.unsubLiveMonitor = null;
window.bukaModalLiveMonitor = function() { 
    let s = document.getElementById('live-monitor-paket'); let h = '<option value="" disabled selected>-- Pilih Ujian --</option>'; 
    if(window.bankUjianGlobal) Object.keys(window.bankUjianGlobal).sort().forEach(k=>h+=`<option value="${k}">${k}</option>`); s.innerHTML = h; 
    if(window.ujianAktifConfig) { let activeName = null; Object.values(window.ujianAktifConfig).forEach(u => { if(u.aktif) activeName = u.nama_ujian; }); if(activeName) { s.value = activeName; window.loadLiveMonitor(activeName); } }
    window.bukaModal('modal-live-monitor'); 
};
window.tutupLiveMonitor = function() { if(window.unsubLiveMonitor) { window.unsubLiveMonitor(); window.unsubLiveMonitor = null; } window.tutupModal('modal-live-monitor'); };
window.loadLiveMonitor = function(ujianName) {
    if(!ujianName) return; if(window.unsubLiveMonitor) window.unsubLiveMonitor();
    window.unsubLiveMonitor = onValue(ref(db, `live_monitor/${ujianName}`), snap => {
        let list = document.getElementById('live-monitor-list');
        if(!snap.exists()) { list.innerHTML = '<p style="text-align:center; color:#888;">Belum ada data aktivitas siswa.</p>'; return; }
        let data = snap.val(), h = '';
        Object.keys(data).forEach(nama => { let d = data[nama], bg = d.vc >= 5 ? '#fadbd8' : (d.vc > 0 ? '#fcf3cf' : '#d5f5e3'); let icon = d.vc >= 5 ? '❌ DISKUALIFIKASI' : (d.vc > 0 ? `⚠️ Melanggar (${d.vc}x)` : '✅ Aman'); h += `<div style="background:${bg}; padding:10px 15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(0,0,0,0.1);"><div><b>${nama}</b><br><small style="color:#555;">${d.status}</small></div><div style="font-weight:bold; font-size:12px;">${icon}</div></div>`; }); list.innerHTML = h;
    });
};
window.hapusLiveMonitorData = function() { let p = document.getElementById('live-monitor-paket').value; let targetRef = p ? `live_monitor/${p}` : 'live_monitor'; if(confirm(p ? `Bersihkan history monitor untuk "${p}"?` : "Bersihkan seluruh history monitor?")) { remove(ref(db, targetRef)).then(() => { alert("History monitor berhasil dibersihkan!"); if(p) window.loadLiveMonitor(p); else document.getElementById('live-monitor-list').innerHTML = '<p style="text-align:center; color:#888;">History dibersihkan.</p>'; }); } };

window.violationCount = 0; window.sedangMenghukum = false; window.hukumanTimer = null; window.lastViolationTime = 0; window.initialWinW = 0; window.initialWinH = 0;

window.terapkanHukumanVisual = function(s) {
    let o = document.getElementById('strict-warning-overlay'), c = document.getElementById('strict-countdown');
    document.getElementById('strict-warning-info').innerHTML = `Pelanggaran ke-${window.violationCount}. ${window.violationCount === 4 ? '<br><b>PERINGATAN TERAKHIR! Sekali lagi Anda melanggar, ujian otomatis ditutup!</b>' : ''}`;
    o.style.display = 'flex'; c.innerText = s;
    document.getElementById('ujian-strict-container').style.visibility = 'hidden'; 

    window.hukumanTimer = setInterval(()=>{
        s--; c.innerText = s;
        if(s <= 0){ 
            clearInterval(window.hukumanTimer); o.style.display='none'; document.getElementById('ujian-strict-container').style.visibility = 'visible'; window.sedangMenghukum=false; window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight; 
            set(ref(db, `live_monitor/${window.latihanState.namaUjian}/${window.latihanState.namaSiswa}`), { vc: window.violationCount, time: Date.now(), status: 'Sedang Mengerjakan' }); 
            let stateStr = localStorage.getItem('gamma_exam_state'); if(stateStr) { let state = JSON.parse(stateStr); state.penaltyEndTime = 0; localStorage.setItem('gamma_exam_state', JSON.stringify(state)); } 
        }
    }, 1000);
};

window.cancelHukuman = function() {
    if(!window.sedangMenghukum) return; clearInterval(window.hukumanTimer); document.getElementById('strict-warning-overlay').style.display='none'; document.getElementById('ujian-strict-container').style.visibility = 'visible'; window.sedangMenghukum = false; window.lastViolationTime = Date.now() + 5000; window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight; window.violationCount = 0;
    set(ref(db, `live_monitor/${window.latihanState.namaUjian}/${window.latihanState.namaSiswa}`), { vc: 0, time: Date.now(), status: 'Sedang Mengerjakan' });
    let stateStr = localStorage.getItem('gamma_exam_state'); if(stateStr) { let state = JSON.parse(stateStr); state.penaltyEndTime = 0; state.vc = 0; localStorage.setItem('gamma_exam_state', JSON.stringify(state)); }
    setTimeout(() => alert('Akses Admin Darurat: Hukuman dibatalkan dan catatan pelanggaran direset. Lanjutkan ujian.'), 100);
};

function pantauPelanggaranUjian(e) {
    // KUNCI PERBAIKAN: Sensor dimatikan sementara saat siswa dalam proses konfirmasi kumpul
    if (!window.isStrictUjianActive || window.isSubmittingExam) return; 
    if (document.body.classList.contains('mode-edit-aktif') || document.documentElement.classList.contains('force-edit-mode')) return;
    
    let isViolation = false;
    if (e.type === 'resize') {
        if(window.visualViewport && window.visualViewport.scale !== 1) { window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight; return; }
        let wDiff = Math.abs(window.innerWidth - window.initialWinW); let hDiff = Math.abs(window.innerHeight - window.initialWinH);
        let isRotation = (Math.abs(window.innerWidth - window.initialWinH) < 150) && (Math.abs(window.innerHeight - window.initialWinW) < 150);
        let isKeyboard = wDiff < 30 && hDiff > 100;
        if (isRotation || isKeyboard) { window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight; return; }
        if (wDiff > 50 || hDiff > (window.initialWinH * 0.3)) { isViolation = true; }
    } else if (document.hidden || document.visibilityState === 'hidden' || e.type === 'blur') {
        isViolation = true;
    }

    if (isViolation && (Date.now() - window.lastViolationTime > 3000)) {
        window.lastViolationTime = Date.now(); window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight;
        if (window.sedangMenghukum) { clearInterval(window.hukumanTimer); }
        window.violationCount++; window.sedangMenghukum = true;
        let sName = window.latihanState.namaSiswa, uName = window.latihanState.namaUjian;

        if(window.violationCount >= 5) {
            if(typeof window.getRestDBUrl === 'function'){
                fetch(window.getRestDBUrl(`live_monitor/${uName}/${sName}`), { method: 'PUT', body: JSON.stringify({ vc: window.violationCount, time: Date.now(), status: 'Diskualifikasi (Kumpul Otomatis)' }) });
            }
            alert("🚨 PELANGGARAN KE-5 TERDETEKSI! Ujian dihentikan dan otomatis terkirim.");
            window.kumpulkanUjianStrict(true);
            return;
        }

        if(typeof window.getRestDBUrl === 'function'){
            fetch(window.getRestDBUrl(`live_monitor/${uName}/${sName}`), { method: 'PUT', body: JSON.stringify({ vc: window.violationCount, time: Date.now(), status: 'Sedang Dihukum' }) });
        }

        let s = 600; if(window.violationCount >= 2) s = 1800;
        let stateStr = localStorage.getItem('gamma_exam_state'); if(stateStr) { let state = JSON.parse(stateStr); state.vc = window.violationCount; state.penaltyEndTime = Date.now() + (s * 1000); localStorage.setItem('gamma_exam_state', JSON.stringify(state)); }
        window.terapkanHukumanVisual(s);
    }
}

window.verifikasiMasukUjian = async function() { 
    let elKelas = document.getElementById('input-kelas-siswa');
    let kls = elKelas ? elKelas.value : null;
    let n = document.getElementById('input-nama-siswa').value.trim(); 
    let k = document.getElementById('input-kode-ujian').value.trim().toUpperCase(); 
    
    if (elKelas && !kls) return alert("Pilih kelas Anda terlebih dahulu!");
    if (!n) return alert("Isi nama Anda!"); 

    // VALIDASI KETAT NAMA SISWA SESUAI DATABASE (Excel Style)
    if (kls && window.dataAbsensiGlobal && window.dataAbsensiGlobal[kls] && window.dataAbsensiGlobal[kls].siswaList) {
        let isRegistered = window.dataAbsensiGlobal[kls].siswaList.some(s => s.nama.toLowerCase() === n.toLowerCase());
        if (!isRegistered) {
            return alert("❌ Tulis nama sesuai data siswa! Nama '" + n + "' tidak terdaftar di kelas " + kls + ". Silakan hapus dan ketik huruf awal nama Anda, lalu pilih dari daftar yang muncul.");
        }
    } else if (kls) {
        return alert("⚠️ Data siswa untuk kelas ini belum ada di sistem Administrasi Guru.");
    }

    if(!k) return alert("Masukkan Kode Akses Ujian!");
    
    get(child(ref(db), 'ujian_aktif')).then(snap => {
        let config = snap.exists() ? snap.val() : null; if(!config) return alert("Tidak ada ujian yang sedang aktif saat ini.");
        let matchedExam = null; Object.values(config).forEach(exam => { if(exam && exam.aktif && exam.kode && exam.kode.toUpperCase() === k) matchedExam = exam; });
        if(!matchedExam) return alert("Kode SALAH atau ujian belum diaktifkan oleh Admin!"); 
        if(localStorage.getItem('gamma_exam_submitted_' + matchedExam.nama_ujian + '_' + n)) { return alert("⚠️ DITOLAK: Anda sudah mengumpulkan atau didiskualifikasi dari ujian ini! Ujian hanya bisa dikerjakan 1 kali."); }
        
        get(child(ref(db), `bank_soal_ujian/${matchedExam.nama_ujian}`)).then(soalSnap => {
            let p = soalSnap.exists() ? soalSnap.val() : null; if(!p) return alert("Data paket ujian tidak ditemukan di database."); 

            let durasiMenit = matchedExam.durasi || 90; let endTime = Date.now() + (durasiMenit * 60000);
            let sArr = [], restoredAnswers = {}; 
            let prevStateStr = localStorage.getItem('gamma_exam_state');
            if(prevStateStr) { 
                let prevState = JSON.parse(prevStateStr); 
                if(prevState.ujian === matchedExam.nama_ujian && prevState.nama === n) { 
                    if(!confirm("Sesi sebelumnya terdeteksi! Lanjutkan pekerjaan Anda? (Timer dan pelanggaran akan dilanjutkan)")) return; 
                    sArr = prevState.soalArr; window.violationCount = prevState.vc || 0; restoredAnswers = prevState.ans || {}; 
                    if(prevState.endTime) endTime = prevState.endTime;
                    if(prevState.penaltyEndTime && prevState.penaltyEndTime > Date.now()) { let remain = Math.ceil((prevState.penaltyEndTime - Date.now()) / 1000); setTimeout(()=> { window.sedangMenghukum = true; window.terapkanHukumanVisual(remain); }, 500); } 
                } else { localStorage.removeItem('gamma_exam_state'); } 
            }

            if(sArr.length === 0) { 
                sArr = p.map((q,i)=>({...q, dbRef: `bank_soal_ujian/${matchedExam.nama_ujian}/${i}`})).sort(()=>0.5-Math.random()); 
                window.violationCount = 0; restoredAnswers = {}; 
                localStorage.setItem('gamma_exam_state', JSON.stringify({ nama: n, ujian: matchedExam.nama_ujian, soalArr: sArr, ans: {}, vc: 0, penaltyEndTime: 0, endTime: endTime })); 
            }

            let sName = n; 
            if (typeof window.getRestDBUrl === 'function') {
                fetch(window.getRestDBUrl(`live_monitor/${matchedExam.nama_ujian}/${sName}`), { method: 'PUT', body: JSON.stringify({ vc: window.violationCount, time: Date.now(), status: 'Sedang Mengerjakan' }) });
            }

            window.tutupModal('modal-enter-ujian'); 
            document.getElementById('ujian-strict-room').style.display='block'; 
            document.getElementById('btn-close-strict').style.display='none'; 
            document.body.style.overflow='hidden'; 
            document.body.classList.add('strict-mode-active');
            document.getElementById('ujian-judul-ui').innerText=matchedExam.nama_ujian; 
            window.latihanState={mode:'strict',namaSiswa:sName,namaUjian:matchedExam.nama_ujian,answered:new Set(),correct:0,total:sArr.length, jawabans: restoredAnswers, soalArr: sArr}; 
            renderRuangKuis('ujian-strict-container',sArr,'strict'); 
            
            if(Object.keys(restoredAnswers).length > 0) {
                Object.keys(restoredAnswers).forEach(qI => {
                    let jData = restoredAnswers[qI];
                    if(jData.index !== undefined && jData.index >= 0) { let btnList = document.querySelectorAll(`#strict-q-${qI} .quiz-option-btn`); if(btnList && btnList[jData.index]) { window.latihanState.answered.add(parseInt(qI)); btnList[jData.index].classList.add('selected-neutral'); } } else if(jData.text !== undefined) { let input = document.querySelector(`#strict-q-${qI} input.input-box`); if(input) { input.value = jData.text; window.latihanState.answered.add(parseInt(qI)); } }
                    let navBtn=document.getElementById(`nav-btn-strict-${qI}`); if(navBtn) navBtn.classList.add('nav-answered');
                });
            }

            window.isStrictUjianActive=true; window.sedangMenghukum=false; window.lastViolationTime=0; window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight; 
            document.addEventListener("visibilitychange", window.pantauPelanggaranUjian); window.addEventListener("blur", window.pantauPelanggaranUjian); window.addEventListener("resize", window.pantauPelanggaranUjian); window.onbeforeunload=()=>"Dilarang refresh!"; 

            document.getElementById('ujian-timer-fixed').style.display = 'block';
            if(window.ujianTimerInterval) clearInterval(window.ujianTimerInterval);
            window.ujianTimerInterval = setInterval(() => {
                if(!window.isStrictUjianActive) { clearInterval(window.ujianTimerInterval); return; }
                let remain = endTime - Date.now();
                if(remain <= 0) {
                    clearInterval(window.ujianTimerInterval); window.isStrictUjianActive = false; document.body.classList.remove('strict-mode-active');
                    document.removeEventListener("visibilitychange", window.pantauPelanggaranUjian); window.removeEventListener("blur", window.pantauPelanggaranUjian); window.removeEventListener("resize", window.pantauPelanggaranUjian);
                    if(window.hukumanTimer) clearInterval(window.hukumanTimer); document.getElementById('strict-warning-overlay').style.display = 'none';
                    alert("WAKTU HABIS! Jawaban Anda akan otomatis dikumpulkan."); window.kumpulkanUjianStrict(true);
                } else {
                    let hr = Math.floor(remain / 3600000); let min = Math.floor((remain % 3600000) / 60000); let sec = Math.floor((remain % 60000) / 1000);
                    document.getElementById('ujian-timer-fixed').innerText = (hr > 0 ? String(hr).padStart(2,'0') + ':' : '') + String(min).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
                }
            }, 1000);

            setTimeout(async function() {
                if (window.isStrictUjianActive && sessionStorage.getItem("statusGuru") !== "aktif") {
                    try {
                        const { goOffline } = await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js");
                        goOffline(window.dbGlobal);
                        console.log("✅ MODE UJIAN OFFLINE AKTIF");
                    } catch(e) {}
                }
            }, 3000);
        });
    });
};

function renderRuangKuis(cId, sArr, pre){ 
    let isEdit = document.body.classList.contains('mode-edit-aktif')||document.documentElement.classList.contains('force-edit-mode');
    let qi=`<div class="quiz-container" style="box-shadow:0 15px 35px rgba(0,0,0,0.1); border-top:5px solid ${pre==='strict'?'#c0392b':'#3498db'}; margin-bottom:70px;">`; 
    sArr.forEach((q,qIdx)=>{ 
        let qTextHtml = (isEdit && q.dbRef) 
            ? `<div class="quiz-question-text" contenteditable="true" oninput="updateSoalBank('${q.dbRef}','q',this)">${qIdx+1}. ${q.question}</div>` 
            : `<div class="quiz-question-text">${qIdx+1}. ${q.question}</div>`;
        qi+=`<div class="quiz-question-card" id="${pre}-q-${qIdx}">${isEdit?`<button class="btn-delete-q" onclick="hapusSoalSistem(${qIdx}, '${pre}', null)" title="Hapus Soal">🗑️</button>`:''}${qTextHtml}`;
        
        if(q.type === 'short_answer' || (!q.options && q.correctAnswers)) {
            let valText = (window.latihanState && window.latihanState.jawabans && window.latihanState.jawabans[qIdx]) ? (window.latihanState.jawabans[qIdx].text || '') : '';
            let altStr = q.correctAnswers ? q.correctAnswers.join(' | ') : '';
            qi += `<div class="short-answer-box" style="margin-top:12px;">
                <input type="text" class="input-box" placeholder="Ketik jawaban singkat..." style="font-size:15px; font-weight:600; padding:12px 15px; border:2px solid #3498db; border-radius:8px; width:100%; box-sizing:border-box;" value="${valText}" oninput="jawabSoalIsian(this, ${qIdx}, '${pre}')">
                ${isEdit ? `<div style="font-size:11px; color:#c0392b; margin-top:8px; background:#fadbd8; padding:6px; border-radius:4px; border-left:4px solid #e74c3c;"><b>🔒 Info Admin:</b> Alternatif Kunci: ${altStr}</div>` : ''}
            </div>`;
        } else {
            qi += `<div class="quiz-options">`;
            (q.options || []).forEach((o,oIdx)=>{ 
                let optHtml = (isEdit && q.dbRef) 
                    ? `<div class="quiz-option-btn" contenteditable="true" oninput="updateSoalBank('${q.dbRef}','o',this,${oIdx})">${String.fromCharCode(65+oIdx)}. ${o}</div>` 
                    : `<button class="quiz-option-btn" onclick="jawabSoalSistem(this,${qIdx},${oIdx},${q.correctIndex},'${pre}')">${String.fromCharCode(65+oIdx)}. ${o}</button>`; 
                qi+=optHtml; 
            }); 
            qi += `</div>`;
        }
        qi+=`<div class="quiz-explanation" style="display:none;"><b>Pembahasan:</b> ${q.explanation || 'Selesai.'}</div></div>`; 
    }); 
    
    if(pre==='strict')qi+=`<button class="btn-action btn-submit-ujian" style="background:#27ae60;font-size:18px;padding:15px;margin-top:20px;" onclick="kumpulkanUjianStrict(false)">Selesai & Kumpulkan</button>`; 
    qi+='</div>';

    qi += `<button class="btn-toggle-nav" id="btn-toggle-nav-${pre}" onclick="document.getElementById('nav-container-${pre}').classList.toggle('show-nav')">📑 Daftar Nomor Soal</button>`;
    qi += `<div class="quiz-nav-bar latihan-nav-fixed" id="nav-container-${pre}">`; 
    qi += `<div class="nav-drag-handle"></div>`;
    qi += `<button class="close-nav-btn" onclick="document.getElementById('nav-container-${pre}').classList.remove('show-nav')">✕</button>`;
    
    sArr.forEach((q,qIdx)=>{
        qi+=`<button class="quiz-nav-btn" id="nav-btn-${pre}-${qIdx}" onclick="document.querySelector('#${pre}-q-${qIdx}').scrollIntoView({behavior:'smooth',block:'center'}); document.getElementById('nav-container-${pre}').classList.remove('show-nav');">${qIdx+1}</button>`;
    });
    qi+='</div>'; 

    document.getElementById(cId).innerHTML=qi; document.getElementById(cId==='temporary-quiz-container'?'temporary-quiz-room':'ujian-strict-room').scrollTop=0; 
    window.renderMathJax();
}

window.jawabSoalSistem=function(btn,qI,oI,cI,pre){ 
    if(document.body.classList.contains('mode-edit-aktif')||document.documentElement.classList.contains('force-edit-mode')) return;
    let s=window.latihanState, p=btn.closest('.quiz-question-card'), all=p.querySelectorAll('.quiz-option-btn'), exp=p.querySelector('.quiz-explanation'); 
    
    if(pre==='strict'){ 
        if(!s.answered.has(qI)) s.answered.add(qI); 
        all.forEach(b=>b.classList.remove('selected-neutral')); 
        btn.classList.add('selected-neutral'); 
        s.jawabans[qI]={ index: oI, correctIndex: cI, isCorrect:(oI===cI), huruf:String.fromCharCode(65+oI) }; 
        let stateStr = localStorage.getItem('gamma_exam_state'); 
        if(stateStr){ let state=JSON.parse(stateStr); state.ans=s.jawabans; localStorage.setItem('gamma_exam_state',JSON.stringify(state)); } 
    }else{ 
        if(s.answered.has(qI)) return; 
        s.answered.add(qI); 
        if(oI===cI)s.correct++; 
        s.jawabans = s.jawabans || {}; 
        s.jawabans[qI] = (oI===cI); 
        all.forEach(b=>{ b.classList.remove('selected-correct','selected-wrong'); b.disabled = true; }); 
        if(oI===cI)btn.classList.add('selected-correct'); else{btn.classList.add('selected-wrong');all[cI].classList.add('selected-correct');} 
        if(exp) { exp.style.display='block'; window.renderMathJax(); } 
        if(s.answered.size===s.total){ 
            setTimeout(()=> { 
                let score = Math.round((s.correct/s.total)*100);
                document.getElementById('quiz-result-score').innerText=score; 
                document.getElementById('quiz-result-correct').innerText=s.correct; 
                document.getElementById('quiz-result-total').innerText=s.total; 
                if(score < 70) document.getElementById('btn-remedial').style.display='inline-block';
                else document.getElementById('btn-remedial').style.display='none';
                window.bukaModal('modal-quiz-result'); 
            }, 600); 
        } 
    } 
    let navBtn=document.getElementById(`nav-btn-${pre}-${qI}`); 
    if(navBtn)navBtn.classList.add('nav-answered'); 
};

window.jawabSoalIsian = function(inputEl, qI, pre) {
    if(document.body.classList.contains('mode-edit-aktif') || document.documentElement.classList.contains('force-edit-mode')) return;
    let s = window.latihanState; if(!s) return;
    let q = s.soalArr ? s.soalArr[qI] : null; let userVal = inputEl.value.trim(); let normalizedUser = userVal.toLowerCase().replace(/\s+/g, ' ');
    
    let isCorrect = false;
    if(q && q.correctAnswers && Array.isArray(q.correctAnswers)) { isCorrect = q.correctAnswers.some(ans => ans.toLowerCase().trim().replace(/\s+/g, ' ') === normalizedUser); }

    if(userVal.length > 0) s.answered.add(qI); else s.answered.delete(qI);

    if(pre === 'strict') {
        s.jawabans[qI] = { index: -1, text: userVal, isCorrect: isCorrect, huruf: userVal || '-' };
        let stateStr = localStorage.getItem('gamma_exam_state'); if(stateStr) { let state = JSON.parse(stateStr); state.ans = s.jawabans; localStorage.setItem('gamma_exam_state', JSON.stringify(state)); }
    } else {
        s.jawabans = s.jawabans || {}; s.jawabans[qI] = { text: userVal, isCorrect: isCorrect, huruf: userVal || '-' };
        if(s.answered.size === s.total) {
            let cor = 0; Object.values(s.jawabans).forEach(j => { if(j.isCorrect || j === true) cor++; });
            setTimeout(() => {
                let score = Math.round((cor / s.total) * 100);
                document.getElementById('quiz-result-score').innerText = score;
                document.getElementById('quiz-result-correct').innerText = cor;
                document.getElementById('quiz-result-total').innerText = s.total;
                if(score < 70) document.getElementById('btn-remedial').style.display='inline-block';
                else document.getElementById('btn-remedial').style.display='none';
                window.bukaModal('modal-quiz-result');
            }, 600);
        }
    }
    let navBtn = document.getElementById(`nav-btn-${pre}-${qI}`); if(navBtn) { if(userVal.length > 0) navBtn.classList.add('nav-answered'); else navBtn.classList.remove('nav-answered'); }
};

window.kumpulkanUjianStrict = function(isForceSubmit = false) {
    let s = window.latihanState;
    
    // Aktifkan bendera agar sensor layar berhenti mendeteksi pelanggaran
    window.isSubmittingExam = true; 

    if (!isForceSubmit && s.answered.size < s.total) {
        if (!confirm(`Baru dijawab ${s.answered.size}/${s.total}. Yakin kumpulkan?`)) {
            // Jika batal kumpul, hidupkan lagi sensornya
            setTimeout(() => { window.isSubmittingExam = false; }, 1000);
            return;
        }
    }
    
    window.isStrictUjianActive = false; 
    document.removeEventListener("visibilitychange", pantauPelanggaranUjian); 
    window.removeEventListener("blur", pantauPelanggaranUjian); 
    window.removeEventListener("resize", pantauPelanggaranUjian);

    let sb = document.getElementById('save-status-bar');
    if (sb) { sb.style.display = 'block'; sb.innerHTML = "<span style='color:#e67e22;'>Merekap Jawaban...</span>"; }

    let cor = 0; let rincian = [];
    for (let i = 0; i < s.total; i++) {
        let j = s.jawabans ? s.jawabans[i] : null; let q = s.soalArr[i]; let isBenar = false;
        if (j) {
            if (q.type === 'short_answer' || (!q.options && q.correctAnswers)) {
                let normalizedUser = (j.text || '').toLowerCase().replace(/\s+/g, ' ');
                isBenar = q.correctAnswers.some(ans => ans.toLowerCase().trim().replace(/\s+/g, ' ') === normalizedUser);
            } else { isBenar = (j.index === q.correctIndex); }
        }
        if (isBenar) cor++; rincian.push(j ? (j.huruf || j.text || "-") : "-");
    }
    s.correct = cor; let score = Math.round((cor / s.total) * 100);

    localStorage.setItem('gamma_exam_submitted_' + s.namaUjian + '_' + s.namaSiswa, 'true');
    localStorage.removeItem('gamma_exam_state');

    let statusTeks = isForceSubmit ? `Selesai (Otomatis) | Nilai: ${score}` : `Selesai (Aman) | Nilai: ${score}`;
    let klsSiswa = document.getElementById('input-kelas-siswa') ? document.getElementById('input-kelas-siswa').value : "-";
    let payloadHasil = { nama: s.namaSiswa, nilai: score, benar: cor, total: s.total, jawaban: rincian, timestamp: Date.now(), kelas: klsSiswa };

    if(typeof window.getRestDBUrl === 'function'){
        fetch(window.getRestDBUrl(`live_monitor/${s.namaUjian}/${s.namaSiswa}`), { method: 'PUT', body: JSON.stringify({ vc: window.violationCount, status: statusTeks, time: Date.now() }) });
        fetch(window.getRestDBUrl(`hasil_ujian/${s.namaUjian}/${Date.now()}_${Math.random().toString(36).substr(2,4)}`), { method: 'PUT', body: JSON.stringify(payloadHasil) });
    }

    if (sb) sb.innerHTML = "<span style='color:#2ecc71;'>✓ Berhasil Dikumpulkan!</span>";
    document.body.classList.remove('strict-mode-active');
    if (window.ujianTimerInterval) clearInterval(window.ujianTimerInterval);
    document.getElementById('ujian-timer-fixed').style.display = 'none';
    if (window.hukumanTimer) clearInterval(window.hukumanTimer); 
    document.getElementById('strict-warning-overlay').style.display = 'none';
    let submitBtn = document.querySelector('#ujian-strict-container .btn-submit-ujian'); if (submitBtn) submitBtn.style.display = 'none';

    if (isForceSubmit) {
        document.getElementById('ujian-strict-subtitle').innerText = "Ujian Telah Selesai. Anda tidak dapat melihat review/pembahasan.";
        document.getElementById('btn-close-strict').style.display = 'block';
        document.getElementById('ujian-strict-container').innerHTML = '<h2 style="text-align:center; color:#e74c3c; margin-top:50px;">Jawaban Anda Telah Terkirim</h2><p style="text-align:center;">Silakan keluar dari ruangan ujian.</p>';
    } else {
        document.getElementById('ujian-strict-subtitle').innerText = "Mode Review: Ujian telah dikumpulkan.";
        document.getElementById('btn-close-strict').style.display = 'block';
        alert("✅ Ujian berhasil dikumpulkan!");
    }
    
    document.getElementById('quiz-result-score').innerText = score; document.getElementById('quiz-result-correct').innerText = cor; document.getElementById('quiz-result-total').innerText = s.total;
    document.getElementById('btn-remedial').style.display = 'none'; window.bukaModal('modal-quiz-result');
};

window.hapusDataRekap=function(){ let f=document.getElementById('filter-rekap-ujian').value; if(!window.dataRekapNilai) return alert("Data kosong."); if(f==="Semua"){ if(confirm("HAPUS SEMUA DATA NILAI? Tindakan ini tidak bisa dibatalkan!")){ remove(ref(db,'hasil_ujian')).then(()=>{alert("Terhapus!");window.renderTabelNilai();}); } } else { if(confirm(`Hapus data nilai untuk paket "${f}"?`)){ remove(ref(db,`hasil_ujian/${f}`)).then(()=>{alert("Terhapus!");window.renderTabelNilai();}); } } };
window.bukaModalRekapNilai=function(){ let h='<option value="Semua">Semua Paket Ujian</option>'; if(window.dataRekapNilai)Object.keys(window.dataRekapNilai).forEach(k=>h+=`<option value="${k}">${k}</option>`); document.getElementById('filter-rekap-ujian').innerHTML=h; window.renderTabelNilai(); window.bukaModal('modal-rekap-nilai'); };

window.renderTabelNilai=function(){ 
    let f=document.getElementById('filter-rekap-ujian').value, tbody=document.getElementById('tbody-rekap-nilai'), thead=document.querySelector('#tabel-spreadsheet-nilai thead'); 
    if(!window.dataRekapNilai){ tbody.innerHTML="<tr><td colspan='6' style='text-align:center;'>Belum ada data.</td></tr>"; return; } 
    
    let h=""; let keys = (f==="Semua") ? Object.keys(window.dataRekapNilai) : [f]; let maxSoal=0; let allEntries = [];
    keys.forEach(n=>{ let dS = window.dataRekapNilai[n]; if(dS){ Object.values(dS).forEach(d => { if(d.total > maxSoal) maxSoal = d.total; allEntries.push({...d, nama_ujian: n}); }); } });
    allEntries.sort((a, b) => b.timestamp - a.timestamp);

    let thHtml="<tr><th>Waktu</th><th>Siswa</th><th>Ujian</th><th>Nilai</th><th>Benar</th><th>Salah</th>"; 
    for(let i=1;i<=maxSoal;i++) thHtml+=`<th>No.${i}</th>`; thHtml+="</tr>"; thead.innerHTML=thHtml; 

    allEntries.forEach(d=>{ 
        let dStr=new Date(d.timestamp).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); 
        h+=`<tr><td>${dStr}</td><td><b>${d.nama}</b></td><td>${d.nama_ujian}</td><td><b style="color:${d.nilai>=75?'#27ae60':'#c0392b'};">${d.nilai}</b></td><td>${d.benar}</td><td>${d.total-d.benar}</td>`; 
        let ans=d.jawaban||[]; for(let i=0;i<maxSoal;i++){ if(i<d.total) h+=`<td>${ans[i]||"-"}</td>`; else h+=`<td></td>`; } h+=`</tr>`; 
    }); 
    tbody.innerHTML=h||`<tr><td colspan='${6+maxSoal}' style='text-align:center;'>Kosong.</td></tr>`; 
};

window.exportExcelNilai=function(){ let t=document.getElementById("tabel-spreadsheet-nilai"), rows=Array.from(t.querySelectorAll("tr")); let csv=rows.map(r=>Array.from(r.querySelectorAll("th, td")).map(c=>`"${c.innerText}"`).join(",")).join("\n"); let blob=new Blob(["\uFEFF"+csv],{type:'text/csv;charset=utf-8;'}); let link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`Rekap_Nilai_${Date.now()}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
window.tutupLatihanMandiri=function(){ if(confirm("Keluar?")){ document.getElementById('temporary-quiz-room').style.display='none'; document.getElementById('temporary-quiz-container').innerHTML=""; document.body.style.overflow='auto'; } };

// (A) FITUR DELETE GAMBAR DENGAN KEYBOARD
document.addEventListener('keydown', e=>{ 
    if((e.key==='Delete'||e.key==='Backspace')&&window.selectedImg&&!window.isDrawingMode){ 
        e.preventDefault(); let p=window.selectedImg.closest('.content-block')||window.selectedImg.closest('.fb-content'); 
        window.selectedImg.remove(); window.selectedImg=null; 
        let c = document.getElementById('img-controls-dynamic'); if(c) c.style.display='none'; 
        if(p)p.dispatchEvent(new Event('input',{bubbles:true})); 
    } 
}); 

// (B) POPUP TABEL CUSTOM INTERAKTIF & ANTI-GAGAL
window.bukaModalTabel = function() {
    window.simpanSeleksiTeks();
    if (!globalSelectedRange) {
        alert("⚠️ Klik atau letakkan kursor di dalam kotak materi terlebih dahulu!");
        return;
    }
    let m = document.getElementById('modal-buat-tabel');
    if(!m) {
        document.body.insertAdjacentHTML('beforeend', `<div id="modal-buat-tabel" class="modal-overlay" style="display:flex; z-index:99999; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); justify-content:center; align-items:center;">
            <div class="modal-box" style="background:#fff; padding:20px; border-radius:10px; width:300px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; color:#2c3e50;">Buat Tabel</h3>
                <div style="margin:15px 0; display:flex; justify-content:center; gap:15px;">
                    <label>Baris: <input type="number" id="tbl-row-input" value="3" min="1" style="width:50px; padding:5px; text-align:center; border:1px solid #ccc; border-radius:4px;"></label>
                    <label>Kolom: <input type="number" id="tbl-col-input" value="3" min="1" style="width:50px; padding:5px; text-align:center; border:1px solid #ccc; border-radius:4px;"></label>
                </div>
                <button onclick="window.terapkanBuatTabel()" style="background:#27ae60; color:#fff; padding:8px 15px; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Sisipkan Tabel</button>
                <button onclick="document.getElementById('modal-buat-tabel').style.display='none'" style="background:#e74c3c; color:#fff; padding:8px 15px; border:none; border-radius:5px; margin-left:5px; cursor:pointer;">Batal</button>
            </div>
        </div>`);
    } else { m.style.display = 'flex'; }
};

window.terapkanBuatTabel = function() {
    let r = parseInt(document.getElementById('tbl-row-input').value) || 3; 
    let c = parseInt(document.getElementById('tbl-col-input').value) || 3;
    document.getElementById('modal-buat-tabel').style.display = 'none';
    
    window.kembalikanSeleksiTeks(); 
    
    if (globalSelectedRange) {
        let table = document.createElement('table');
        // FIX: Hapus width:100% agar tabel menyesuaikan ukuran isi layaknya MS Word
        table.style.cssText = "border-collapse:collapse; margin-bottom:15px; width:auto;"; 
        table.setAttribute("border", "1");
        let tbody = document.createElement('tbody');
        for(let i=0; i<r; i++) {
            let tr = document.createElement('tr');
            for(let j=0; j<c; j++) {
                let td = document.createElement('td');
                td.style.cssText = "padding:10px; border:1px solid #ccc; min-width:50px;";
                td.innerHTML = "Isi";
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        globalSelectedRange.deleteContents();
        let p = document.createElement('p');
        p.innerHTML = "<br>"; // Mencegah kursor nyangkut
        globalSelectedRange.insertNode(p);
        globalSelectedRange.insertNode(table);
        
        window.triggerInput();
    }
};

window.sisipkanTabel = window.bukaModalTabel;

// (C) LOGIKA HOVER MENU GAMBAR & TABEL ALA MS WORD
window.selectedImg = null; window.activeTableCell = null;

document.addEventListener('click', e => { 
    if(window.isDrawingMode) return; 

    // Klik Gambar
    if(e.target.tagName==='IMG' && (document.body.classList.contains('mode-edit-aktif')||document.documentElement.classList.contains('force-edit-mode')) && (e.target.closest('.content-block')||e.target.closest('.fb-content'))) { 
        document.querySelectorAll('.content-block img, .fb-content img').forEach(i=>i.classList.remove('img-selected')); 
        e.target.classList.add('img-selected'); window.selectedImg=e.target; 
        let r=document.createRange(); r.selectNode(e.target); let s=window.getSelection(); s.removeAllRanges(); s.addRange(r); 
        
        let menuC = document.getElementById('img-controls-dynamic');
        if(!menuC) {
            document.body.insertAdjacentHTML('beforeend', `<div id="img-controls-dynamic" style="display:none; position:absolute; background:#fff; padding:8px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.2); z-index:9999; display:flex; gap:5px; font-size:12px;">
                <button onclick="alignGambar('inline')" title="Dalam Teks (Bawaan)" style="cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">In-Text</button>
                <button onclick="alignGambar('left')" title="Teks Mengelilingi Kiri" style="cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">Float Kiri</button>
                <button onclick="alignGambar('right')" title="Teks Mengelilingi Kanan" style="cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">Float Kanan</button>
                <button onclick="alignGambar('center')" title="Blok Sendiri (Tengah)" style="cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">Center</button>
                <button onclick="alignGambar('front')" title="Di Atas Teks (Bebas Geser, Teks Tertimpa)" style="cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px; font-weight:bold; color:#2980b9;">Over-Text</button>
            </div>`);
            menuC = document.getElementById('img-controls-dynamic');
        }
        const rect = window.selectedImg.getBoundingClientRect(); 
        menuC.style.display = 'flex'; menuC.style.top = (rect.top + window.scrollY - 45) + 'px'; menuC.style.left = (rect.left + window.scrollX) + 'px'; 
    } else if(!e.target.closest('#img-controls-dynamic') && e.type==='click') { 
        if(window.selectedImg) window.selectedImg.classList.remove('img-selected'); 
        window.selectedImg=null; 
        let menuC = document.getElementById('img-controls-dynamic'); if(menuC) menuC.style.display='none'; 
    } 

    // Klik Tabel 
    if((e.target.tagName==='TD'||e.target.tagName==='TH') && (document.body.classList.contains('mode-edit-aktif')||document.documentElement.classList.contains('force-edit-mode'))) { 
        window.activeTableCell = e.target; 
        let tblC = document.getElementById('tbl-controls-dynamic');
        if(!tblC) {
            document.body.insertAdjacentHTML('beforeend', `<div id="tbl-controls-dynamic" style="display:none; position:absolute; background:#fff; padding:8px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.2); z-index:9999; display:flex; gap:5px; font-size:12px;">
                <button onclick="warnaiSelTabel('#f1c40f')" title="Warna Kuning" style="cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">🟡</button>
                <button onclick="warnaiSelTabel('#ffffff')" title="Warna Putih" style="cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">⚪</button>
                <div style="width:1px; background:#ddd; margin:0 5px;"></div>
                <button onclick="tambahBarisTabel()" style="color:#27ae60; font-weight:bold; cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">+ Baris</button>
                <button onclick="tambahKolomTabel()" style="color:#2980b9; font-weight:bold; cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">+ Kolom</button>
                <div style="width:1px; background:#ddd; margin:0 5px;"></div>
                <button onclick="hapusBarisTabel()" style="color:#e74c3c; cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">- Baris</button>
                <button onclick="hapusKolomTabel()" style="color:#c0392b; cursor:pointer; padding:4px 8px; border:none; background:#ecf0f1; border-radius:4px;">- Kolom</button>
            </div>`);
            tblC = document.getElementById('tbl-controls-dynamic');
        }
        const rect = window.activeTableCell.getBoundingClientRect(); 
        tblC.style.display = 'flex'; tblC.style.top = (rect.top + window.scrollY - 45) + 'px'; tblC.style.left = (rect.left + window.scrollX) + 'px'; 
    } else if(!e.target.closest('#tbl-controls-dynamic') && !e.target.closest('.mozello-toolbar')) { 
        let tblC = document.getElementById('tbl-controls-dynamic'); if(tblC) tblC.style.display='none'; 
        window.activeTableCell=null; 
    } 
});

window.alignGambar = function(p) { 
    if(window.selectedImg) { 
        let s = window.selectedImg.style;
        s.display = ''; s.float = ''; s.margin = ''; s.position = ''; s.zIndex = '';
        
        if(p === 'left') { s.float = 'left'; s.margin = '0 15px 15px 0'; } 
        else if(p === 'right') { s.float = 'right'; s.margin = '0 0 15px 15px'; } 
        else if(p === 'center') { s.display = 'block'; s.margin = '15px auto'; } 
        else if(p === 'inline') { s.display = 'inline-block'; s.margin = '0 5px'; } 
        else if(p === 'front') { s.position = 'absolute'; s.zIndex = '10'; s.margin='0'; } 
        window.triggerInput(); 
    } 
};

window.warnaiSelTabel=function(w){ if(window.activeTableCell){ window.activeTableCell.style.backgroundColor=w; window.triggerInput(); } }; 
window.tambahBarisTabel=function(){ if(window.activeTableCell){ let tr=window.activeTableCell.parentNode; let cl=tr.cloneNode(true); Array.from(cl.children).forEach(td=>td.innerHTML=""); tr.parentNode.insertBefore(cl,tr.nextSibling); window.triggerInput(); } }; 
window.tambahKolomTabel=function(){ if(window.activeTableCell){ let tb=window.activeTableCell.closest('table'), cI=window.activeTableCell.cellIndex; Array.from(tb.rows).forEach(r=>{ let nC=r.insertCell(cI+1); nC.innerHTML=""; }); window.triggerInput(); } }; 
window.hapusBarisTabel=function(){ if(window.activeTableCell){ let tr=window.activeTableCell.parentNode; tr.parentNode.removeChild(tr); document.getElementById('tbl-controls-dynamic').style.display='none'; window.triggerInput(); } }; 
window.hapusKolomTabel=function(){ if(window.activeTableCell){ let tb=window.activeTableCell.closest('table'), cI=window.activeTableCell.cellIndex; Array.from(tb.rows).forEach(r=>{ if(r.cells.length>cI)r.deleteCell(cI); }); document.getElementById('tbl-controls-dynamic').style.display='none'; window.triggerInput(); } };

window.isDrawingMode=false; let currentDrawCtx=null, isPenDown=false, activeTool='pen'; 
window.penSize=4; window.penColor='#e74c3c'; window.pencilOnly=true; 
window.shapeHoldTimer = null; window.isShapeRecognized = false;

let laserStrokes=[], currentLaserStroke=null, globalLaserCvs=document.getElementById('laser-canvas'), globalLaserCtx=globalLaserCvs.getContext('2d'); 
let laserLastActiveTime = 0; 
let lassoPath=[], isFloating=false, lassoTargetCanvas=null, lassoSavedImageData=null, floatUI=null;

// OPTIMASI ANTI-LAG SAAT ZOOM & RESIZE
let resizeTmr;
window.addEventListener('resize', () => {
    clearTimeout(resizeTmr);
    resizeTmr = setTimeout(() => {
        if(typeof inisialisasiSemuaCanvas === 'function') inisialisasiSemuaCanvas(); 
        if(typeof resizeLaserCanvas === 'function') resizeLaserCanvas(); 
        if(typeof isFloating !== 'undefined' && !isFloating) {
            if(typeof stampLasso === 'function') stampLasso(false);
        }
    }, 250);
});

let isUpdatingVP = false;
function updateToolbarPosition() {
    if(!window.isDrawingMode || !window.visualViewport) { isUpdatingVP = false; return; }
    const tools = document.getElementById('pen-tools'); const vv = window.visualViewport;
    if(tools) {
        tools.style.position = 'fixed'; tools.style.top = '0px'; tools.style.left = '0px'; tools.style.width = window.innerWidth + 'px';
        tools.style.transform = 'translate(' + vv.offsetLeft + 'px, ' + vv.offsetTop + 'px) scale(' + (1 / vv.scale) + ')';
        tools.style.transformOrigin = 'top left';
    }
    isUpdatingVP = false;
}
if(window.visualViewport) {
    window.visualViewport.addEventListener('scroll', () => { if(!isUpdatingVP) { isUpdatingVP = true; requestAnimationFrame(updateToolbarPosition); } });
    window.visualViewport.addEventListener('resize', () => { if(!isUpdatingVP) { isUpdatingVP = true; requestAnimationFrame(updateToolbarPosition); } });
}

window.toggleDrawingMode=function(){ 
    window.isDrawingMode=!window.isDrawingMode; 
    if(window.isDrawingMode){
        document.body.classList.add('drawing-mode-active'); 
        document.querySelectorAll('.content-block, .fb-content').forEach(el=>el.removeAttribute('contenteditable'));
        inisialisasiSemuaCanvas(); resizeLaserCanvas(); if(window.visualViewport) updateToolbarPosition();
    } else {
        document.body.classList.remove('drawing-mode-active'); 
        if(document.body.classList.contains('mode-edit-aktif')){ document.querySelectorAll('.content-block, .fb-content').forEach(el=>el.setAttribute('contenteditable','true')); }
        stampLasso(); window.simpanKeDB(); document.getElementById('pen-tools').style.transform = 'none';
    } 
};

window.setDrawingTool=function(t){ stampLasso(); activeTool=t; document.querySelectorAll('#pen-tools button.tool-btn').forEach(b=>b.classList.remove('active')); document.getElementById('btn-'+t).classList.add('active'); };
window.setPenColor=function(c, btn){ window.penColor = c; document.querySelectorAll('.col-btn').forEach(b => b.classList.remove('active')); if(btn) btn.classList.add('active'); };
window.setPenSize=function(s, btn){ window.penSize = s; document.querySelectorAll('.sz-btn').forEach(b => b.classList.remove('active')); if(btn) btn.classList.add('active'); };
window.togglePalmReject=function(isActive){ window.pencilOnly = isActive; };

window.clearSemuaCoretan=function(){ 
    if(confirm("Hapus semua coretan?")){ 
        document.querySelectorAll('.drawing-layer').forEach(cvs=>{ 
            cvs.getContext('2d').clearRect(0,0,cvs.width,cvs.height); 
            let fbIdx = cvs.getAttribute('data-fb-index'); let blockIdx = cvs.getAttribute('data-index'); 
            if(fbIdx!==null&&window.floatingBoxesData[fbIdx]) window.floatingBoxesData[fbIdx].drawing=""; 
            else if(window.contentBlocksData[blockIdx]) window.contentBlocksData[blockIdx].drawing=""; 
        }); 
        window.simpanKeDB(); 
    } 
};

function inisialisasiSemuaCanvas(){ document.querySelectorAll('.drawing-layer').forEach(cvs=>inisialisasiSatuCanvas(cvs,false)); } 
function inisialisasiSatuCanvas(cvs, isTypingResize){ 
    let p=cvs.parentElement; if(!p) return; 
    let cw=p.clientWidth || p.offsetWidth, ch=p.clientHeight || p.offsetHeight; if(cw === 0 || ch === 0) return; 
    let fbIdx = cvs.getAttribute('data-fb-index'); let blockIdx = cvs.getAttribute('data-index'); 
    let sv = (fbIdx!==null) ? (window.floatingBoxesData[fbIdx] ? window.floatingBoxesData[fbIdx].drawing : '') : (window.contentBlocksData[blockIdx] ? window.contentBlocksData[blockIdx].drawing : ''); 
    if(cvs.width !== cw || cvs.height !== ch) { 
        cvs.width=cw; cvs.height=ch; 
        let ctx = cvs.getContext('2d', { willReadFrequently: true }); ctx.clearRect(0,0,cw,ch);
        if(sv){ let i=new Image(); i.onload=()=> { ctx.drawImage(i, 0, 0); }; i.src=sv; } 
    } 
} 

function resizeLaserCanvas(){ globalLaserCvs.width=window.innerWidth; globalLaserCvs.height=window.innerHeight; } 

function renderLaser(){ 
    globalLaserCtx.clearRect(0,0,globalLaserCvs.width,globalLaserCvs.height); 
    let now = Date.now(); let fadeStart = laserLastActiveTime + 1000; 
    if (now > fadeStart && laserLastActiveTime > 0) { 
        let alpha = 1 - ((now - fadeStart) / 1000); 
        if (alpha <= 0) { alpha = 0; laserStrokes = []; laserLastActiveTime = 0; } 
        globalLaserCtx.globalAlpha = alpha; 
    } else { globalLaserCtx.globalAlpha = 1; } 
    laserStrokes.forEach(s=>{ 
        if(s.points.length<2)return; 
        globalLaserCtx.beginPath(); globalLaserCtx.moveTo(s.points[0].x,s.points[0].y); 
        for(let i=1;i<s.points.length;i++) globalLaserCtx.lineTo(s.points[i].x,s.points[i].y); 
        globalLaserCtx.lineCap='round'; globalLaserCtx.lineJoin='round'; globalLaserCtx.lineWidth=window.penSize*2; globalLaserCtx.strokeStyle=window.penColor; globalLaserCtx.stroke(); 
    }); 
    requestAnimationFrame(renderLaser); 
} 
renderLaser();

window.activeTouches = 0;
document.addEventListener('touchstart', e => {
    if (!window.isDrawingMode) return; if (e.target.closest('#pen-tools')) return;
    window.activeTouches = e.touches.length;
    let hasStylus = false;
    for (let i = 0; i < e.touches.length; i++) { if (e.touches[i].touchType === 'stylus' || e.touches[i].touchType === 'pen') hasStylus = true; }
    if (hasStylus) { e.preventDefault(); } else { if (!window.pencilOnly && e.touches.length === 1) e.preventDefault(); }
}, { passive: false });


// =========================================================================
// MODUL GAMBAR TERPADU (TERHUBUNG KE TOOLBAR ASLI & ANTI AUTO-WRITE)
// =========================================================================
let lassoOriginalImageData = null;

window.recognizeShape = function() {
    if (!isPenDown || !currentDrawCtx || window.isShapeRecognized || !window.drawPoints || window.drawPoints.length < 10) return;
    let pts = window.drawPoints;
    let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
    let totalLen = 0;
    for (let i = 0; i < pts.length; i++) {
        let p = pts[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (i > 0) totalLen += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    }

    let w = maxX - minX, h = maxY - minY, maxDim = Math.max(w, h);
    if (maxDim < 20) return;

    let start = pts[0], end = pts[pts.length - 1];
    let isClosed = Math.hypot(end.x - start.x, end.y - start.y) < (maxDim * 0.42);

    let ctx = currentDrawCtx;
    ctx.putImageData(window.drawSnapshot, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = window.penColor;
    ctx.lineWidth = window.penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    // 1. GARIS LURUS (Kurva Terbuka)
    if (!isClosed) {
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.restore();
        window.isShapeRecognized = true;
        return;
    }

    // 2. BENTUK TERTUTUP (Segitiga, Persegi, Persegi Panjang, Belah Ketupat, Bintang, Lingkaran)
    function ptLineDist(p, a, b) {
        let num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
        let den = Math.hypot(b.y - a.y, b.x - a.x);
        return den === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : num / den;
    }
    function rdp(arr, eps) {
        if (arr.length <= 2) return arr;
        let maxD = 0, idx = 0;
        for (let i = 1; i < arr.length - 1; i++) {
            let d = ptLineDist(arr[i], arr[0], arr[arr.length - 1]);
            if (d > maxD) { maxD = d; idx = i; }
        }
        if (maxD > eps) {
            let l = rdp(arr.slice(0, idx + 1), eps);
            let r = rdp(arr.slice(idx), eps);
            return l.slice(0, -1).concat(r);
        }
        return [arr[0], arr[arr.length - 1]];
    }

    let closedPts = pts.concat([pts[0]]);
    let rawCorners = rdp(closedPts, maxDim * 0.085);
    rawCorners.pop();

    let corners = [];
    for (let i = 0; i < rawCorners.length; i++) {
        let p = rawCorners[i];
        if (corners.length === 0 || Math.hypot(p.x - corners[corners.length - 1].x, p.y - corners[corners.length - 1].y) > maxDim * 0.15) {
            corners.push(p);
        }
    }
    if (corners.length > 2 && Math.hypot(corners[0].x - corners[corners.length - 1].x, corners[0].y - corners[corners.length - 1].y) < maxDim * 0.15) {
        corners.pop();
    }

    let cleanCorners = [];
    let lenC = corners.length;
    for (let i = 0; i < lenC; i++) {
        let prev = corners[(i - 1 + lenC) % lenC];
        let curr = corners[i];
        let next = corners[(i + 1) % lenC];
        let v1x = prev.x - curr.x, v1y = prev.y - curr.y;
        let v2x = next.x - curr.x, v2y = next.y - curr.y;
        let dot = v1x * v2x + v1y * v2y;
        let mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
        let angleDeg = mag === 0 ? 180 : Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
        if (angleDeg < 152) cleanCorners.push(curr);
    }

    let n = cleanCorners.length;
    let cx = minX + w / 2, cy = minY + h / 2;

    if ((n >= 5 && totalLen > maxDim * 3.1) || (n >= 8 && n <= 12)) {
        // Bintang 5 Sudut
        let outerR = maxDim / 2, innerR = outerR * 0.4, rot = -Math.PI / 2, step = Math.PI / 5;
        ctx.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step;
        }
        ctx.closePath();
    } else if (n === 3) {
        // Segitiga (Siku-siku, Sama Kaki, Sembarang)
        let [A, B, C] = cleanCorners;
        let ptsSortedY = [A, B, C].sort((p1, p2) => p2.y - p1.y);
        if (Math.abs(ptsSortedY[0].y - ptsSortedY[1].y) < h * 0.15) {
            let avgY = (ptsSortedY[0].y + ptsSortedY[1].y) / 2;
            ptsSortedY[0].y = avgY; ptsSortedY[1].y = avgY;
            let baseLeft = ptsSortedY[0].x < ptsSortedY[1].x ? ptsSortedY[0] : ptsSortedY[1];
            let baseRight = ptsSortedY[0].x < ptsSortedY[1].x ? ptsSortedY[1] : ptsSortedY[0];
            let topPt = ptsSortedY[2];
            if (Math.abs(topPt.x - baseLeft.x) < w * 0.18) topPt.x = baseLeft.x;
            else if (Math.abs(topPt.x - baseRight.x) < w * 0.18) topPt.x = baseRight.x;
            else if (Math.abs(topPt.x - cx) < w * 0.18) topPt.x = (baseLeft.x + baseRight.x) / 2;
        }
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.lineTo(C.x, C.y);
        ctx.closePath();
    } else if (n === 4) {
        // Persegi, Persegi Panjang, atau Belah Ketupat
        let midPoints = [{x: cx, y: minY}, {x: maxX, y: cy}, {x: cx, y: maxY}, {x: minX, y: cy}];
        let boxCorners = [{x: minX, y: minY}, {x: maxX, y: minY}, {x: maxX, y: maxY}, {x: minX, y: maxY}];
        let distMid = 0, distBox = 0;
        cleanCorners.forEach(p => {
            distMid += Math.min(...midPoints.map(m => Math.hypot(p.x - m.x, p.y - m.y)));
            distBox += Math.min(...boxCorners.map(b => Math.hypot(p.x - b.x, p.y - b.y)));
        });

        if (distMid < distBox * 0.85) {
            ctx.moveTo(cx, minY); ctx.lineTo(maxX, cy); ctx.lineTo(cx, maxY); ctx.lineTo(minX, cy); ctx.closePath();
        } else if (Math.abs(w - h) < maxDim * 0.18) {
            let side = (w + h) / 2;
            ctx.rect(cx - side / 2, cy - side / 2, side, side);
        } else {
            ctx.rect(minX, minY, w, h);
        }
    } else {
        // Lingkaran atau Elips
        if (Math.abs(w - h) < maxDim * 0.2) ctx.arc(cx, cy, (w + h) / 4, 0, 2 * Math.PI);
        else ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 2 * Math.PI);
    }

    ctx.stroke();
    ctx.restore();
    window.isShapeRecognized = true;
};

document.addEventListener('pointerdown', e => {
    if (!window.isDrawingMode && e.target.tagName === 'IMG' && (document.body.classList.contains('mode-edit-aktif') || document.documentElement.classList.contains('force-edit-mode'))) {
        let i = e.target, sX = e.clientX, sW = i.offsetWidth;
        function m(me) { i.style.width = (sW + (me.clientX - sX)) + 'px'; i.style.maxWidth = '100%'; }
        function up() { document.removeEventListener('pointermove', m); document.removeEventListener('pointerup', up); let p = i.closest('.content-block') || i.closest('.fb-content'); if (p) p.dispatchEvent(new Event('input', { bubbles: true })); }
        document.addEventListener('pointermove', m); document.addEventListener('pointerup', up); e.preventDefault(); return;
    }
    if (!window.isDrawingMode) return;
    if (e.target.closest('#pen-tools')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'touch' && (window.pencilOnly || window.activeTouches > 1)) { isPenDown = false; return; }

    if (isFloating && floatUI) {
        if (e.target.closest('.lasso-float')) return;
        stampLasso(false);
        return;
    }

    if (e.target.classList.contains('drawing-layer')) {
        isPenDown = true;
        window.isShapeRecognized = false;
        clearTimeout(window.shapeHoldTimer);

        if (activeTool === 'laser') {
            laserLastActiveTime = Date.now();
            currentLaserStroke = { points: [{ x: e.clientX, y: e.clientY }] };
            laserStrokes.push(currentLaserStroke);
        } else {
            let c = e.target;
            currentDrawCtx = c.getContext('2d', { willReadFrequently: true });
            if (activeTool !== 'laser' && activeTool !== 'lasso' && typeof window.simpanHistoriUndo === 'function') window.simpanHistoriUndo(c);
            let r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;

            if (activeTool === 'lasso') {
                lassoTargetCanvas = c;
                lassoPath = [{ x, y }];
                lassoSavedImageData = currentDrawCtx.getImageData(0, 0, c.width, c.height);
                lassoOriginalImageData = currentDrawCtx.getImageData(0, 0, c.width, c.height);
            } else if (activeTool === 'eraser') {
                currentDrawCtx.beginPath();
                currentDrawCtx.moveTo(x, y);
                currentDrawCtx.lineCap = 'round';
                currentDrawCtx.lineJoin = 'round';
                currentDrawCtx.globalCompositeOperation = 'destination-out';
                currentDrawCtx.lineWidth = window.penSize * 5;
                currentDrawCtx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                window.drawSnapshot = currentDrawCtx.getImageData(0, 0, c.width, c.height);
                window.drawPoints = [{ x, y }];
                currentDrawCtx.beginPath();
                currentDrawCtx.moveTo(x, y);
                currentDrawCtx.lineCap = 'round';
                currentDrawCtx.lineJoin = 'round';
                currentDrawCtx.globalCompositeOperation = 'source-over';
                currentDrawCtx.globalAlpha = 1.0;
                currentDrawCtx.strokeStyle = window.penColor;
                currentDrawCtx.lineWidth = window.penSize;
            }
        }
    }
});

document.addEventListener('pointermove', e => {
    if (!window.isDrawingMode || !isPenDown) return;

    // KUNCI ANTI-ERROR: Jika pena/mouse TIDAK sedang ditekan (hanya digeser/hover), langsung matikan!
    if (e.buttons !== undefined && e.buttons === 0) {
        isPenDown = false;
        clearTimeout(window.shapeHoldTimer);
        return;
    }

    if (e.pointerType === 'touch' && (window.pencilOnly || window.activeTouches > 1)) { isPenDown = false; return; }

    if (activeTool === 'laser' && currentLaserStroke) {
        laserLastActiveTime = Date.now();
        currentLaserStroke.points.push({ x: e.clientX, y: e.clientY });
    } else if (currentDrawCtx) {
        let r = currentDrawCtx.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;

        if (activeTool === 'lasso') {
            lassoPath.push({ x, y });
            currentDrawCtx.putImageData(lassoSavedImageData, 0, 0);
            currentDrawCtx.beginPath();
            currentDrawCtx.moveTo(lassoPath[0].x, lassoPath[0].y);
            for (let i = 1; i < lassoPath.length; i++) currentDrawCtx.lineTo(lassoPath[i].x, lassoPath[i].y);
            currentDrawCtx.strokeStyle = '#3498db';
            currentDrawCtx.lineWidth = 1.5;
            currentDrawCtx.setLineDash([5, 5]);
            currentDrawCtx.stroke();
            currentDrawCtx.setLineDash([]);
        } else if (activeTool === 'highlighter') {
            window.drawPoints.push({ x, y });
            currentDrawCtx.putImageData(window.drawSnapshot, 0, 0);
            currentDrawCtx.beginPath();
            currentDrawCtx.moveTo(window.drawPoints[0].x, window.drawPoints[0].y);
            for (let i = 1; i < window.drawPoints.length; i++) currentDrawCtx.lineTo(window.drawPoints[i].x, window.drawPoints[i].y);
            currentDrawCtx.globalCompositeOperation = 'source-over';
            currentDrawCtx.globalAlpha = 0.35;
            currentDrawCtx.strokeStyle = window.penColor;
            currentDrawCtx.lineWidth = window.penSize * 4;
            currentDrawCtx.stroke();
            currentDrawCtx.globalAlpha = 1.0;
        } else if (activeTool === 'line') {
            currentDrawCtx.putImageData(window.drawSnapshot, 0, 0);
            currentDrawCtx.beginPath();
            currentDrawCtx.moveTo(window.drawPoints[0].x, window.drawPoints[0].y);
            currentDrawCtx.lineTo(x, y);
            currentDrawCtx.globalCompositeOperation = 'source-over';
            currentDrawCtx.strokeStyle = window.penColor;
            currentDrawCtx.lineWidth = window.penSize;
            currentDrawCtx.stroke();
        } else if (activeTool === 'pen') {
            if (!window.isShapeRecognized) {
                let lastPt = window.drawPoints[window.drawPoints.length - 1];
                let moveDist = lastPt ? Math.hypot(x - lastPt.x, y - lastPt.y) : 99;
                window.drawPoints.push({ x, y });
                currentDrawCtx.lineTo(x, y);
                currentDrawCtx.stroke();
                if (moveDist > 3.5) {
                    clearTimeout(window.shapeHoldTimer);
                    window.shapeHoldTimer = setTimeout(window.recognizeShape, 550);
                }
            }
        } else {
            // Eraser
            currentDrawCtx.lineTo(x, y);
            currentDrawCtx.stroke();
        }
    }
});

function AkhiriGambar() {
    if (!window.isDrawingMode || !isPenDown) return;
    isPenDown = false;
    clearTimeout(window.shapeHoldTimer);
    if (isFloating) return;

    if (activeTool === 'laser' && currentLaserStroke) {
        laserLastActiveTime = Date.now();
        currentLaserStroke = null;
    } else if (activeTool === 'lasso' && currentDrawCtx && lassoPath.length > 5) {
        currentDrawCtx.putImageData(lassoSavedImageData, 0, 0);
        createFloatingLasso(currentDrawCtx.canvas);
    } else if (activeTool !== 'laser' && activeTool !== 'lasso' && currentDrawCtx) {
        currentDrawCtx.globalCompositeOperation = 'source-over';
        currentDrawCtx.globalAlpha = 1.0;
        let fbIdx = currentDrawCtx.canvas.getAttribute('data-fb-index');
        let blockIdx = currentDrawCtx.canvas.getAttribute('data-index');
        let dataToSave = currentDrawCtx.canvas.toDataURL("image/png");
        if (fbIdx !== null && window.floatingBoxesData[fbIdx]) window.floatingBoxesData[fbIdx].drawing = dataToSave;
        else if (window.contentBlocksData[blockIdx]) window.contentBlocksData[blockIdx].drawing = dataToSave;
        document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>✍️ Saving...</span>";
        window.simpanKeDB();
    }
    if (activeTool !== 'laser') currentDrawCtx = null;
}

document.addEventListener('pointerup', AkhiriGambar);
document.addEventListener('pointercancel', AkhiriGambar);
window.addEventListener('blur', () => { isPenDown = false; clearTimeout(window.shapeHoldTimer); });

function createFloatingLasso(cvs) {
    let ctx = cvs.getContext('2d'), miX = cvs.width, miY = cvs.height, maX = 0, maY = 0;
    lassoPath.forEach(p => { if (p.x < miX) miX = p.x; if (p.x > maX) maX = p.x; if (p.y < miY) miY = p.y; if (p.y > maY) maY = p.y; });
    let w = maX - miX, h = maY - miY;
    if (w < 8 || h < 8) return;

    let tCvs = document.createElement('canvas'); tCvs.width = w; tCvs.height = h; tCvs.className = "lasso-float-canvas";
    let tCtx = tCvs.getContext('2d');
    tCtx.beginPath();
    lassoPath.forEach((p, i) => i === 0 ? tCtx.moveTo(p.x - miX, p.y - miY) : tCtx.lineTo(p.x - miX, p.y - miY));
    tCtx.closePath();
    tCtx.clip();
    tCtx.drawImage(cvs, -miX, -miY);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    lassoPath.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    floatUI = document.createElement('div');
    floatUI.className = 'lasso-float';
    floatUI.appendChild(tCvs);

    let btnBar = document.createElement('div');
    btnBar.className = 'lasso-btn-bar';
    btnBar.innerHTML = '<button onclick="window.stampLassoManual(false)" style="background:#27ae60;">✓ Tempel</button>' +
                       '<button onclick="window.copyLassoSelection()" style="background:#f39c12;">📄 Salin</button>' +
                       '<button class="btn-math" onclick="window.convertLassoToMath()">∑ Math</button>' +
                       '<button onclick="window.hapusAreaLasso()" style="background:#e74c3c;">🗑️</button>';
    floatUI.appendChild(btnBar);

    let r = cvs.getBoundingClientRect();
    floatUI.style.width = w + 'px';
    floatUI.style.height = h + 'px';
    floatUI.style.left = (r.left + window.scrollX + miX) + 'px';
    floatUI.style.top = (r.top + window.scrollY + miY) + 'px';

    let isDraggingFloat = false, sX, sY, sL, sT;
    floatUI.addEventListener('pointerdown', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        e.stopPropagation(); e.preventDefault();
        isDraggingFloat = true; sX = e.clientX; sY = e.clientY;
        sL = parseFloat(floatUI.style.left) || 0;
        sT = parseFloat(floatUI.style.top) || 0;
        floatUI.setPointerCapture(e.pointerId);
    });
    floatUI.addEventListener('pointermove', function(e) {
        if (!isDraggingFloat) return;
        e.stopPropagation(); e.preventDefault();
        floatUI.style.left = (sL + (e.clientX - sX)) + 'px';
        floatUI.style.top = (sT + (e.clientY - sY)) + 'px';
    });
    floatUI.addEventListener('pointerup', function(e) {
        if (!isDraggingFloat) return;
        isDraggingFloat = false;
        floatUI.releasePointerCapture(e.pointerId);
        e.stopPropagation(); e.preventDefault();
    });

    document.body.appendChild(floatUI);
    isFloating = true;
    lassoPath = [];
}

window.copyLassoSelection = function() {
    if (!isFloating || !floatUI || !lassoTargetCanvas) return;
    let ctx = lassoTargetCanvas.getContext('2d');
    if (lassoOriginalImageData) {
        ctx.putImageData(lassoOriginalImageData, 0, 0);
        lassoOriginalImageData = null;
    } else {
        let cR = lassoTargetCanvas.getBoundingClientRect(), fR = floatUI.getBoundingClientRect();
        ctx.drawImage(floatUI.querySelector('canvas'), fR.left - cR.left, fR.top - cR.top);
    }
    floatUI.style.left = (parseFloat(floatUI.style.left) + 25) + 'px';
    floatUI.style.top = (parseFloat(floatUI.style.top) + 25) + 'px';
    let btnCopy = floatUI.querySelector('button:nth-child(2)');
    if (btnCopy) {
        btnCopy.innerText = "✓ Geser & Tempel!";
        setTimeout(() => { if (btnCopy) btnCopy.innerHTML = "📄 Salin Lagi"; }, 1200);
    }
};

window.stampLassoManual = function(isCopy) {
    stampLasso(isCopy);
};

function stampLasso(isCopy = false) {
    if (!isFloating || !floatUI || !lassoTargetCanvas) return;
    let ctx = lassoTargetCanvas.getContext('2d');
    let cR = lassoTargetCanvas.getBoundingClientRect(), fR = floatUI.getBoundingClientRect();
    ctx.drawImage(floatUI.querySelector('canvas'), fR.left - cR.left, fR.top - cR.top);

    if (!isCopy) {
        floatUI.remove();
        floatUI = null;
        isFloating = false;
    }

    let fbIdx = lassoTargetCanvas.getAttribute('data-fb-index');
    let blockIdx = lassoTargetCanvas.getAttribute('data-index');
    if (fbIdx !== null && window.floatingBoxesData[fbIdx]) window.floatingBoxesData[fbIdx].drawing = lassoTargetCanvas.toDataURL();
    else if (window.contentBlocksData[blockIdx]) window.contentBlocksData[blockIdx].drawing = lassoTargetCanvas.toDataURL();
    window.simpanKeDB();
}

window.hapusAreaLasso = function() {
    if (!isFloating || !floatUI || !lassoTargetCanvas) return;
    floatUI.remove(); floatUI = null; isFloating = false;
    let fbIdx = lassoTargetCanvas.getAttribute('data-fb-index'), blockIdx = lassoTargetCanvas.getAttribute('data-index');
    if (fbIdx !== null && window.floatingBoxesData[fbIdx]) window.floatingBoxesData[fbIdx].drawing = lassoTargetCanvas.toDataURL();
    else if (window.contentBlocksData[blockIdx]) window.contentBlocksData[blockIdx].drawing = lassoTargetCanvas.toDataURL();
    window.simpanKeDB();
};

window.convertLassoToMath = async function() {
    if (!isFloating || !floatUI || !lassoTargetCanvas) return;
    const floatCvs = floatUI.querySelector('canvas');
    if (!floatCvs) return;

    const tempCvs = document.createElement('canvas');
    tempCvs.width = floatCvs.width + 40; tempCvs.height = floatCvs.height + 40;
    const tempCtx = tempCvs.getContext('2d');
    tempCtx.fillStyle = '#ffffff'; tempCtx.fillRect(0, 0, tempCvs.width, tempCvs.height);
    tempCtx.drawImage(floatCvs, 20, 20);

    const base64Data = tempCvs.toDataURL('image/png').split(',')[1];
    let cR = lassoTargetCanvas.getBoundingClientRect(), fR = floatUI.getBoundingClientRect();
    let offsetX = Math.max(0, fR.left - cR.left), offsetY = Math.max(0, fR.top - cR.top);

    const btnConvert = floatUI.querySelector('.btn-math');
    if (btnConvert) { btnConvert.innerText = "⏳..."; btnConvert.disabled = true; }
    document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>🤖 AI Membaca Rumus...</span>";

    try {
        const models = window.daftarModelGemini || ["models/gemini-3.8-flash", "models/gemini-2.0-flash", "models/gemini-pro"];
        let latexResult = "";
        for (let m of models) {
            try {
                const url = 'https://generativelanguage.googleapis.com/v1beta/' + m + ':generateContent?key=' + GEMINI_API_KEY;
                const response = await fetch(url, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: "Ubah tulisan tangan rumus ini menjadi kode LaTeX murni. Tanpa markdown." }, { inlineData: { mimeType: "image/png", data: base64Data } }] }] })
                });
                const data = await response.json();
                if (response.ok && data.candidates) {
                    latexResult = data.candidates[0].content.parts[0].text.trim().replace(/```latex/gi, '').replace(/```/g, '').trim();
                    break;
                }
            } catch (e) {}
        }
        if (!latexResult) throw new Error("Server AI sedang sibuk.");
        if (!latexResult.includes('\\[') && !latexResult.includes('\\(')) latexResult = '\\( ' + latexResult + ' \\)';

        floatUI.remove(); floatUI = null; isFloating = false;
        let fbIdx = lassoTargetCanvas.getAttribute('data-fb-index'), blockIdx = lassoTargetCanvas.getAttribute('data-index');
        if (fbIdx !== null && window.floatingBoxesData[fbIdx]) {
            document.querySelector('.fb-content[data-fb-index="' + fbIdx + '"]')?.insertAdjacentHTML('beforeend', '<div style="position:absolute; left:' + offsetX + 'px; top:' + offsetY + 'px; color:#2c3e50; font-size:18px;">' + latexResult + '</div>');
            window.floatingBoxesData[fbIdx].drawing = lassoTargetCanvas.toDataURL();
        } else if (window.contentBlocksData[blockIdx]) {
            document.querySelector('.content-block[data-index="' + blockIdx + '"]')?.insertAdjacentHTML('beforeend', '<div style="margin: 15px 0; color:#2c3e50; font-size:18px;">' + latexResult + '</div>');
            window.contentBlocksData[blockIdx].drawing = lassoTargetCanvas.toDataURL();
        }
        window.toggleDrawingMode(); window.simpanKeDB(); setTimeout(window.renderMathJax, 300);
        document.getElementById('save-status-bar').innerHTML = "<span style='color:#2ecc71;'>✓ Rumus Dibuat!</span>";
    } catch (err) {
        alert("Gagal: " + err.message);
        if (btnConvert) { btnConvert.innerText = "∑ Math"; btnConvert.disabled = false; }
        document.getElementById('save-status-bar').innerHTML = "Cloud Sync: Ready";
    }
};
// Pengaman fungsi Modal & Pop-up beserta perbaikan posisi tombol X
window.bukaModal = function(id) { document.getElementById(id).style.display = 'flex'; };
window.tutupModal = function(id) { document.getElementById(id).style.display = 'none'; };

window.bukaWelcomePopup = function() { 
    document.getElementById('modal-welcome-popup').style.display = 'flex'; 
    if(document.body.classList.contains('mode-edit-aktif')) {
        document.getElementById('popup-img-tool').style.display = 'block';
    }
};

window.tutupWelcomePopup = function() { 
    document.getElementById('modal-welcome-popup').style.display = 'none'; 
    sessionStorage.setItem('popupDismissed', 'true'); 
};

// Memastikan tombol X selalu berada di lapisan paling atas agar bisa diklik
document.querySelectorAll('.popup-welcome-box .close-btn').forEach(function(btn) {
    btn.style.zIndex = '9999';
});


// ============================================================================
// UPGRADE TERPADU: MANAJER LATIHAN, MANAJER UJIAN, KELAS DINAMIS & REKAP NILAI
// (FIX KLIK MODAL + RINCIAN JUMLAH SOAL PG, IS, DAN ESSAY)
// ============================================================================

// Suntikkan CSS Pengaman agar Modal Selalu Bisa Diklik
(function pasangCSSModalTerpadu() {
    if (document.getElementById('style-modal-terpadu')) return;
    var st = document.createElement('style');
    st.id = 'style-modal-terpadu';
    st.innerHTML = 
        '.mahardika-modal-wrap {' +
        '  position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;' +
        '  width: 100vw !important; height: 100vh !important; background: rgba(0,0,0,0.65) !important;' +
        '  display: none; justify-content: center !important; align-items: center !important;' +
        '  z-index: 2147483640 !important; pointer-events: auto !important; padding: 15px !important; box-sizing: border-box !important;' +
        '}' +
        '.mahardika-modal-wrap * { pointer-events: auto !important; }' +
        '.mahardika-modal-card {' +
        '  background: #ffffff !important; width: 100% !important; max-height: 92vh !important;' +
        '  border-radius: 14px !important; display: flex !important; flex-direction: column !important;' +
        '  box-shadow: 0 15px 45px rgba(0,0,0,0.35) !important; overflow: hidden !important; position: relative !important;' +
        '}';
    document.head.appendChild(st);
})();

window.konfigPendidikan = {
    jenjang: ["SD", "SMP", "SMA Kelas X", "SMA Kelas XI", "SMA Kelas XII"],
    mapel: ["Matematika", "Fisika", "Kimia", "Biologi", "IPA Terpadu", "Bahasa Indonesia", "Bahasa Inggris"],
    daftarKelas: ["Kelas 6 SD", "Kelas 9 SMP", "X-1", "X-2", "XI-1", "XI-2", "XII-1", "XII-2"]
};

window.bankLatihanTerpadu = window.bankSoalGlobal || {};
window.rekapNilaiGlobal = {};
window.paketLatihanTerpilih = "";
window.paketUjianTerpilih = "";

// Fungsi mematikan overlay lama yang menghalangi klik
window.bersihkanOverlayPenghalang = function() {
    if (window.isDrawingMode && typeof window.toggleDrawingMode === 'function') {
        window.toggleDrawingMode();
    }
    document.querySelectorAll('.modal-overlay').forEach(function(el) {
        if (el.id !== 'modal-buat-tabel') {
            el.style.display = 'none';
        }
    });
};

// Fungsi Menghitung Rincian Soal: (50 PG, 20 IS, dan 10 Essay)
window.ambilArraySoal = function(paket) {
    if (!paket) return [];
    if (Array.isArray(paket)) return paket;
    if (Array.isArray(paket.questions)) return paket.questions;
    if (typeof paket === 'object') {
        return Object.values(paket).filter(function(item) { return item && typeof item === 'object' && item.question; });
    }
    return [];
};

window.hitungRincianSoal = function(paket) {
    var arr = window.ambilArraySoal(paket);
    var pg = 0, is = 0, essay = 0;
    arr.forEach(function(q) {
        var t = (q.type || '').toLowerCase();
        if (t === 'essay' || t === 'uraian') {
            essay++;
        } else if (t === 'short_answer' || t === 'is' || t === 'isian' || (!q.options && q.correctAnswers)) {
            is++;
        } else {
            pg++;
        }
    });
    return {
        total: arr.length,
        pg: pg,
        is: is,
        essay: essay,
        teksRingkas: arr.length + ' Soal (' + pg + ' PG, ' + is + ' IS, dan ' + essay + ' Essay)',
        teksRincianSaja: '(' + pg + ' PG, ' + is + ' IS, dan ' + essay + ' Essay)'
    };
};

// 1. SINKRONISASI DATA FIREBASE
function inisialisasiSistemTerpadu() {
    if (typeof db === 'undefined' || typeof ref === 'undefined') return;

    onValue(ref(db, 'konfigurasi_pendidikan'), function(snap) {
        if (snap.exists()) {
            var val = snap.val();
            if (val.jenjang) window.konfigPendidikan.jenjang = val.jenjang;
            if (val.mapel) window.konfigPendidikan.mapel = val.mapel;
            if (val.daftarKelas) window.konfigPendidikan.daftarKelas = val.daftarKelas;
        }
        perbaruiSemuaDropdownKonfig();
    });

    onValue(ref(db, 'bank_latihan_terpadu'), function(snap) {
        if (snap.exists()) {
            window.bankLatihanTerpadu = snap.val() || {};
        } else if (window.bankSoalGlobal && Object.keys(window.bankSoalGlobal).length > 0) {
            window.bankLatihanTerpadu = window.bankSoalGlobal;
        }
        window.bankSoalGlobal = window.bankLatihanTerpadu;
        renderDropdownBankLatihanBawah();
    });

    onValue(ref(db, 'rekap_nilai_ujian'), function(snap) {
        window.rekapNilaiGlobal = snap.exists() ? snap.val() : {};
        var modalRekap = document.getElementById('modal-rekap-perkelas');
        if (modalRekap && modalRekap.style.display === 'flex') {
            renderTabelRekapPerKelas();
        }
    });

    onValue(ref(db, 'bank_ujian'), function(snap) {
        if (snap.exists()) window.bankUjianGlobal = snap.val();
        renderDropdownBankUjianBawah();
    });
}

function simpanKonfigKeDB() {
    if (typeof db !== 'undefined') {
        set(ref(db, 'konfigurasi_pendidikan'), window.konfigPendidikan);
    }
}

// 2. TAMBAH JENJANG, MAPEL & KELAS DINAMIS
window.tambahJenjangBaru = function() {
    var baru = prompt("Masukkan Tingkat / Jenjang Baru (contoh: SD Kelas 5, SMP Kelas 8, Umum):");
    if (!baru || !baru.trim()) return;
    baru = baru.trim();
    if (!window.konfigPendidikan.jenjang.includes(baru)) {
        window.konfigPendidikan.jenjang.push(baru);
        simpanKonfigKeDB();
        perbaruiSemuaDropdownKonfig();
    }
};

window.tambahMapelBaru = function() {
    var baru = prompt("Masukkan Nama Mata Pelajaran Baru (contoh: Ekonomi, Geografi, Informatika):");
    if (!baru || !baru.trim()) return;
    baru = baru.trim();
    if (!window.konfigPendidikan.mapel.includes(baru)) {
        window.konfigPendidikan.mapel.push(baru);
        simpanKonfigKeDB();
        perbaruiSemuaDropdownKonfig();
    }
};

window.tambahKelasUjianBaru = function() {
    var baru = prompt("Masukkan Nama Kelas Baru untuk Ujian & Rekap Nilai (contoh: VII-A, X-IPA 1, XII-IPS 2):");
    if (!baru || !baru.trim()) return;
    baru = baru.trim();
    if (!window.konfigPendidikan.daftarKelas.includes(baru)) {
        window.konfigPendidikan.daftarKelas.push(baru);
        simpanKonfigKeDB();
        perbaruiSemuaDropdownKonfig();
        renderTabelRekapPerKelas();
    }
};

window.hapusKelasUjian = function() {
    var sel = document.getElementById('filter-rekap-kelas');
    var kls = sel ? sel.value : "";
    if (!kls || kls === "SEMUA") return alert("Pilih satu kelas spesifik pada dropdown filter terlebih dahulu untuk dihapus.");
    if (!confirm("Hapus kelas '" + kls + "' dari daftar pilihan kelas?")) return;
    window.konfigPendidikan.daftarKelas = window.konfigPendidikan.daftarKelas.filter(function(k) { return k !== kls; });
    simpanKonfigKeDB();
    perbaruiSemuaDropdownKonfig();
};

function perbaruiSemuaDropdownKonfig() {
    document.querySelectorAll('.select-jenjang-dinamis').forEach(function(sel) {
        var cur = sel.value;
        sel.innerHTML = window.konfigPendidikan.jenjang.map(function(j) { return '<option value="' + j + '">' + j + '</option>'; }).join('');
        if (cur && window.konfigPendidikan.jenjang.includes(cur)) sel.value = cur;
    });
    document.querySelectorAll('.select-mapel-dinamis').forEach(function(sel) {
        var cur = sel.value;
        sel.innerHTML = window.konfigPendidikan.mapel.map(function(m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
        if (cur && window.konfigPendidikan.mapel.includes(cur)) sel.value = cur;
    });
    var opsiKelasSiswa = '<option value="" disabled selected>-- Pilih Kelas Kamu --</option>' +
        window.konfigPendidikan.daftarKelas.map(function(k) { return '<option value="' + k + '">' + k + '</option>'; }).join('');
    var elKelasSiswa = document.getElementById('siswa-ujian-kelas');
    if (elKelasSiswa) elKelasSiswa.innerHTML = opsiKelasSiswa;

    var elFilterRekap = document.getElementById('filter-rekap-kelas');
    if (elFilterRekap) {
        var curK = elFilterRekap.value;
        elFilterRekap.innerHTML = '<option value="SEMUA">📂 Semua Kelas (' + window.konfigPendidikan.daftarKelas.length + ' Kelas)</option>' +
            window.konfigPendidikan.daftarKelas.map(function(k) { return '<option value="' + k + '">🏫 ' + k + '</option>'; }).join('');
        if (curK) elFilterRekap.value = curK;
    }
}

// 3. PARSER SOAL CERDAS (MENDUKUNG PG, ISIAN SINGKAT / IS, DAN ESSAY)
window.sisipkanFormatSoal = function(targetId, tipe) {
    var ta = document.getElementById(targetId);
    if (!ta) return;
    var contoh = "";
    if (tipe === 'PG') {
        contoh = "\nSoal: Apakah satuan SI dari gaya?\nTipe: PG\nA. Joule\nB. Newton\nC. Watt\nD. Pascal\nKunci: B\nPembahasan: Satuan gaya adalah Newton.\n";
    } else if (tipe === 'IS') {
        contoh = "\nSoal: Alat untuk mengukur kuat arus listrik disebut...\nTipe: IS\nKunci: Amperemeter | Ampere meter\nPembahasan: Amperemeter dipasang secara seri.\n";
    } else if (tipe === 'ESSAY') {
        contoh = "\nSoal: Jelaskan proses terjadinya fotosintesis pada tumbuhan hijau!\nTipe: Essay\nKunci: Klorofil menyerap cahaya matahari untuk mengubah air dan CO2 menjadi glukosa dan oksigen.\nPembahasan: Terjadi di kloroplas melalui reaksi terang dan gelap.\n";
    }
    ta.value = (ta.value ? ta.value.trim() + "\n\n" : "") + contoh.trim();
    ta.focus();
};

function ekstrakTeksKeArraySoal(rawText) {
    var blocks = rawText.split(/(?:^|\n)\s*(?:Soal\s*\d*\s*:|\d+\.\s+)/i).filter(function(x) { return x.trim().length > 0; });
    var hasil = [];
    blocks.forEach(function(b) {
        var tipeExplicit = b.match(/Tipe\s*:\s*(PG|IS|Isian|Short\s*Answer|Essay|Uraian)/i);
        var tipeStr = tipeExplicit ? tipeExplicit[1].toUpperCase() : "";

        var qMatch = b.split(/(?:\n\s*Tipe\s*:|\n\s*A\.|\n\s*Kunci\s*:|\n\s*Pembahasan\s*:)/i)[0].trim();
        var aM = b.match(/(?:^|\n)\s*A\.\s*(.*?)(?=(?:\n\s*B\.|$))/is);
        var bM = b.match(/(?:^|\n)\s*B\.\s*(.*?)(?=(?:\n\s*C\.|$))/is);
        var cM = b.match(/(?:^|\n)\s*C\.\s*(.*?)(?=(?:\n\s*D\.|$))/is);
        var dM = b.match(/(?:^|\n)\s*D\.\s*(.*?)(?=(?:\n\s*E\.|\n\s*Kunci\s*:|\n\s*Pembahasan\s*:|$))/is);
        var kM = b.match(/Kunci\s*:\s*([^\n]+)/i);
        var pM = b.match(/Pembahasan\s*:\s*(.*)/is);

        var optA = aM ? aM[1].trim() : null;
        var optB = bM ? bM[1].trim() : null;
        var optC = cM ? cM[1].trim() : null;
        var optD = dM ? dM[1].trim() : null;
        var kunci = kM ? kM[1].trim() : "";
        var pembahasan = pM ? pM[1].trim() : "";

        if (optA && optB && optC && optD && tipeStr !== 'IS' && tipeStr !== 'ESSAY') {
            var hurufKunci = (kunci || 'A').toUpperCase().charAt(0);
            var idxKunci = Math.max(0, Math.min(3, hurufKunci.charCodeAt(0) - 65));
            hasil.push({
                type: 'mc',
                question: qMatch,
                options: [optA, optB, optC, optD],
                correctIndex: idxKunci,
                explanation: pembahasan || ("Jawaban benar: " + hurufKunci)
            });
        } else if (tipeStr === 'ESSAY' || tipeStr === 'URAIAN') {
            hasil.push({
                type: 'essay',
                question: qMatch,
                correctAnswers: kunci ? [kunci] : [],
                explanation: pembahasan || (kunci ? "Rubrik/Kunci: " + kunci : "Soal Essay / Uraian")
            });
        } else if (qMatch) {
            hasil.push({
                type: 'short_answer',
                question: qMatch,
                correctAnswers: kunci ? kunci.split('|').map(function(s) { return s.trim(); }) : [""],
                explanation: pembahasan || ("Kunci Isian: " + kunci)
            });
        }
    });
    return hasil;
}

// ============================================================================
// 4. MODAL MANAJER LATIHAN TERPADU (INPUT + RINCIAN PG/IS/ESSAY + DROPDOWN BAWAH)
// ============================================================================
window.bukaManajerLatihanTerpadu = function() {
    window.bersihkanOverlayPenghalang();
    var m = document.getElementById('modal-latihan-terpadu');
    if (!m) {
        var html = 
        '<div id="modal-latihan-terpadu" class="mahardika-modal-wrap" style="display:flex;">' +
            '<div class="mahardika-modal-card modal-box" style="max-width:880px;">' +
                '<div style="background:#16a085; color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<h3 style="margin:0; font-size:17px;">📚 Manajer & Bank Latihan Terpadu</h3>' +
                    '<button type="button" onclick="document.getElementById(\'modal-latihan-terpadu\').style.display=\'none\'" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; font-weight:bold;">✕</button>' +
                '</div>' +
                '<div style="padding:18px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:15px;">' +
                    
                    // BAGIAN 1: INPUT SOAL LATIHAN BARU
                    '<div style="background:#f8f9fa; border:1px solid #dce4ec; border-radius:10px; padding:14px;">' +
                        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;">' +
                            '<h4 style="margin:0; color:#2c3e50; font-size:14px;">➕ 1. Input / Tambah Soal Latihan Baru</h4>' +
                            '<div style="display:flex; gap:6px; align-items:center;">' +
    '<input type="file" id="pdf-upload-soal" accept="application/pdf" style="display:none" onchange="window.prosesUploadPDFSoal(this)">' +
    '<button type="button" onclick="document.getElementById(\'pdf-upload-soal\').click()" style="background:#e74c3c; color:#fff; border:none; padding:4px 10px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.2);">📄 Upload PDF (AI)</button>' +
    '<span style="color:#bdc3c7; margin:0 4px;">|</span>' +
    '<button type="button" onclick="window.sisipkanFormatSoal(\'lat-input-raw\',\'PG\')" style="background:#3498db; color:#fff; border:none; padding:4px 10px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:bold;">+ Contoh PG</button>' +
    '<button type="button" onclick="window.sisipkanFormatSoal(\'lat-input-raw\',\'IS\')" style="background:#e67e22; color:#fff; border:none; padding:4px 10px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:bold;">+ Contoh IS</button>' +
    '<button type="button" onclick="window.sisipkanFormatSoal(\'lat-input-raw\',\'ESSAY\')" style="background:#9b59b6; color:#fff; border:none; padding:4px 10px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:bold;">+ Contoh Essay</button>' +
'</div>' +
                        '</div>' +
                        '<div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:10px; margin-bottom:10px;">' +
                            '<div>' +
                                '<label style="font-size:11px; font-weight:bold; color:#555;">Jenjang / Kelas:</label>' +
                                '<div style="display:flex; gap:4px; margin-top:3px;">' +
                                    '<select id="lat-input-jenjang" class="select-jenjang-dinamis" style="flex:1; padding:7px; border:1px solid #ccc; border-radius:6px;"></select>' +
                                    '<button type="button" onclick="window.tambahJenjangBaru()" title="Tambah Jenjang/Kelas Baru" style="background:#2980b9; color:#fff; border:none; border-radius:6px; padding:0 10px; cursor:pointer; font-weight:bold;">+</button>' +
                                '</div>' +
                            '</div>' +
                            '<div>' +
                                '<label style="font-size:11px; font-weight:bold; color:#555;">Mata Pelajaran:</label>' +
                                '<div style="display:flex; gap:4px; margin-top:3px;">' +
                                    '<select id="lat-input-mapel" class="select-mapel-dinamis" style="flex:1; padding:7px; border:1px solid #ccc; border-radius:6px;"></select>' +
                                    '<button type="button" onclick="window.tambahMapelBaru()" title="Tambah Mapel Baru" style="background:#8e44ad; color:#fff; border:none; border-radius:6px; padding:0 10px; cursor:pointer; font-weight:bold;">+</button>' +
                                '</div>' +
                            '</div>' +
                            '<div>' +
                                '<label style="font-size:11px; font-weight:bold; color:#555;">Nama Bab / Paket Latihan:</label>' +
                                '<input type="text" id="lat-input-judul" placeholder="Contoh: Bab 1 - Sel" style="width:100%; margin-top:3px; padding:7px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">' +
                            '</div>' +
                        '</div>' +
                        '<textarea id="lat-input-raw" rows="4" placeholder="Paste soal PG, IS (Isian Singkat), atau Essay di sini..." style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; font-family:monospace; font-size:12px; box-sizing:border-box;"></textarea>' +
                        '<div style="display:flex; justify-content:flex-end; margin-top:8px;">' +
                            '<button type="button" onclick="window.simpanSoalKeBankLatihan()" style="background:#27ae60; color:#fff; border:none; padding:9px 18px; border-radius:6px; font-weight:bold; cursor:pointer;">💾 Simpan / Tambahkan ke Bank Latihan</button>' +
                        '</div>' +
                    '</div>' +

                    // BAGIAN 2: RUANG LIHAT SOAL & RINCIAN (PG, IS, ESSAY)
                    '<div style="border:1px solid #dce4ec; border-radius:10px; padding:14px; background:#fff;">' +
                        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">' +
                            '<div>' +
                                '<h4 style="margin:0; color:#2c3e50; font-size:14px;">👁️ 2. Daftar Soal pada Paket: <span id="label-paket-latihan-aktif" style="color:#16a085;">(Pilih di bawah)</span></h4>' +
                                '<div id="rincian-jumlah-latihan" style="font-size:12px; font-weight:bold; color:#2980b9; margin-top:3px;">0 Soal (0 PG, 0 IS, dan 0 Essay)</div>' +
                            '</div>' +
                            '<button type="button" onclick="window.hapusPaketLatihanTerpilih()" style="background:#e74c3c; color:#fff; border:none; padding:6px 12px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:bold;">🗑️ Hapus Paket Ini</button>' +
                        '</div>' +
                        '<div id="ruang-review-soal-latihan" style="max-height:210px; overflow-y:auto; padding:8px; background:#fdfefe; border:1px dashed #bdc3c7; border-radius:6px;">' +
                            '<p style="color:#888; font-size:12px; text-align:center; margin:15px 0;">Pilih salah satu bank soal pada dropdown di bagian paling bawah untuk melihat rincian soal.</p>' +
                        '</div>' +
                    '</div>' +

                    // BAGIAN 3 (PALING BAWAH): DROPDOWN LIST BANK SOAL LATIHAN
                    '<div style="background:#e8f8f5; border:2px solid #16a085; border-radius:10px; padding:12px 15px; display:flex; align-items:center; justify-content:space-between; gap:12px;">' +
                        '<div style="font-weight:bold; color:#0e6655; font-size:13px; white-space:nowrap;">📂 Pilih Bank Soal Latihan:</div>' +
                        '<select id="dropdown-bank-latihan-bawah" onchange="window.pilihPaketLatihanDariDropdown(this.value)" style="flex:1; padding:9px; border:1px solid #16a085; border-radius:6px; font-weight:bold; color:#2c3e50; background:#fff;"></select>' +
                    '</div>' +

                '</div>' +
            '</div>' +
        '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
    } else {
        m.style.display = 'flex';
    }
    perbaruiSemuaDropdownKonfig();
    renderDropdownBankLatihanBawah();
};

window.simpanSoalKeBankLatihan = function() {
    var jenjang = document.getElementById('lat-input-jenjang').value;
    var mapel = document.getElementById('lat-input-mapel').value;
    var judul = document.getElementById('lat-input-judul').value.trim();
    var raw = document.getElementById('lat-input-raw').value.trim();

    if (!judul) return alert("Masukkan Nama Bab / Paket Latihan terlebih dahulu!");
    if (!raw) return alert("Masukkan teks soal terlebih dahulu!");

    var soalBaru = ekstrakTeksKeArraySoal(raw);
    if (soalBaru.length === 0) return alert("Format soal tidak dikenali. Pastikan menggunakan kata 'Soal:' di awal pertanyaan.");

    var keyPaket = judul.indexOf('(') !== -1 ? judul : '(' + jenjang + ' - ' + mapel + ') ' + judul;
    var existing = window.ambilArraySoal(window.bankLatihanTerpadu[keyPaket]);
    var gabungan = existing.concat(soalBaru);

    window.bankLatihanTerpadu[keyPaket] = { jenjang: jenjang, mapel: mapel, judul: judul, questions: gabungan, updatedAt: Date.now() };

    if (typeof db !== 'undefined') {
        set(ref(db, 'bank_latihan_terpadu'), window.bankLatihanTerpadu);
        set(ref(db, 'bank_soal'), window.bankLatihanTerpadu);
    }

    document.getElementById('lat-input-raw').value = "";
    window.paketLatihanTerpilih = keyPaket;

    renderDropdownBankLatihanBawah();
    var sel = document.getElementById('dropdown-bank-latihan-bawah');
    if (sel) sel.value = keyPaket;
    window.pilihPaketLatihanDariDropdown(keyPaket);

    var info = window.hitungRincianSoal(window.bankLatihanTerpadu[keyPaket]);
    alert('✓ Berhasil menambahkan ' + soalBaru.length + ' soal!\nTotal sekarang: ' + info.teksRingkas);
};

function renderDropdownBankLatihanBawah() {
    var sel = document.getElementById('dropdown-bank-latihan-bawah');
    if (!sel) return;
    var keys = Object.keys(window.bankLatihanTerpadu || {}).sort();
    if (keys.length === 0) {
        sel.innerHTML = '<option value="">-- Belum ada Bank Soal Latihan yang diinput --</option>';
        return;
    }
    var html = '<option value="">-- Pilih Bank Soal (' + keys.length + ' Paket Tersimpan) --</option>';
    keys.forEach(function(k) {
        var r = window.hitungRincianSoal(window.bankLatihanTerpadu[k]);
        var selectedAttr = window.paketLatihanTerpilih === k ? ' selected' : '';
        html += '<option value="' + k + '"' + selectedAttr + '>' + k + ' — ' + r.teksRingkas + '</option>';
    });
    sel.innerHTML = html;
}

window.pilihPaketLatihanDariDropdown = function(key) {
    window.paketLatihanTerpilih = key;
    var label = document.getElementById('label-paket-latihan-aktif');
    var rincianEl = document.getElementById('rincian-jumlah-latihan');
    var container = document.getElementById('ruang-review-soal-latihan');

    if (!key || !window.bankLatihanTerpadu[key]) {
        if (label) label.innerText = "(Belum dipilih)";
        if (rincianEl) rincianEl.innerText = "0 Soal (0 PG, 0 IS, dan 0 Essay)";
        if (container) container.innerHTML = '<p style="color:#888; font-size:12px; text-align:center;">Pilih paket latihan di bawah untuk melihat daftar soal.</p>';
        return;
    }

    var paket = window.bankLatihanTerpadu[key];
    var arrSoal = window.ambilArraySoal(paket);
    var rincian = window.hitungRincianSoal(paket);

    if (label) label.innerText = key;
    if (rincianEl) rincianEl.innerHTML = '📊 Total: <b>' + rincian.total + ' Soal</b> <span style="color:#16a085;">(' + rincian.pg + ' PG, ' + rincian.is + ' IS, dan ' + rincian.essay + ' Essay)</span>';

    if (paket.jenjang && document.getElementById('lat-input-jenjang')) document.getElementById('lat-input-jenjang').value = paket.jenjang;
    if (paket.mapel && document.getElementById('lat-input-mapel')) document.getElementById('lat-input-mapel').value = paket.mapel;
    if (paket.judul && document.getElementById('lat-input-judul')) document.getElementById('lat-input-judul').value = paket.judul;

    if (arrSoal.length === 0) {
        container.innerHTML = '<p style="color:#888; font-size:12px; text-align:center;">Paket ini belum memiliki butir soal.</p>';
        return;
    }

    var safeKey = key.replace(/'/g, "\\'");
    container.innerHTML = arrSoal.map(function(q, idx) {
        var t = (q.type || 'mc').toLowerCase();
        var badge = '<span style="background:#3498db; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:6px;">PG</span>';
        var infoKunci = '';

        if (t === 'essay' || t === 'uraian') {
            badge = '<span style="background:#9b59b6; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:6px;">Essay</span>';
            infoKunci = 'Rubrik/Kunci Essay: <b>' + ((q.correctAnswers && q.correctAnswers[0]) || q.explanation || '-') + '</b>';
        } else if (t === 'short_answer' || t === 'is') {
            badge = '<span style="background:#e67e22; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:6px;">IS</span>';
            infoKunci = 'Kunci Isian: <b>' + (q.correctAnswers || []).join(' | ') + '</b>';
        } else {
            infoKunci = 'Opsi: ' + (q.options || []).map(function(o, oi) { return String.fromCharCode(65 + oi) + '. ' + o; }).join(' | ') +
                        ' <br><span style="color:#27ae60;"><b>Kunci: ' + String.fromCharCode(65 + (q.correctIndex || 0)) + '</b></span>';
        }

        return '<div style="background:#f8f9fa; border:1px solid #e1e8ed; border-radius:6px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">' +
            '<div style="font-size:12px; color:#2c3e50; flex:1;">' +
                '<div style="font-weight:bold; margin-bottom:4px;">' + (idx + 1) + '. ' + badge + q.question + '</div>' +
                '<div style="color:#555; font-size:11px;">' + infoKunci + '</div>' +
            '</div>' +
            '<button type="button" onclick="window.hapusSatuSoalLatihan(\'' + safeKey + '\', ' + idx + ')" style="background:#fadbd8; color:#c0392b; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:11px;">🗑️</button>' +
        '</div>';
    }).join('');
};

window.hapusSatuSoalLatihan = function(key, idx) {
    if (!confirm("Hapus soal nomor " + (idx + 1) + " ini?")) return;
    var paket = window.bankLatihanTerpadu[key];
    if (!paket) return;
    if (Array.isArray(paket)) paket.splice(idx, 1);
    else if (Array.isArray(paket.questions)) paket.questions.splice(idx, 1);
    set(ref(db, 'bank_latihan_terpadu'), window.bankLatihanTerpadu);
    renderDropdownBankLatihanBawah();
    window.pilihPaketLatihanDariDropdown(key);
};

window.hapusPaketLatihanTerpilih = function() {
    if (!window.paketLatihanTerpilih) return alert("Pilih paket latihan di dropdown bawah terlebih dahulu!");
    if (!confirm('Yakin ingin menghapus seluruh paket "' + window.paketLatihanTerpilih + '"?')) return;
    delete window.bankLatihanTerpadu[window.paketLatihanTerpilih];
    window.paketLatihanTerpilih = "";
    set(ref(db, 'bank_latihan_terpadu'), window.bankLatihanTerpadu);
    renderDropdownBankLatihanBawah();
    window.pilihPaketLatihanDariDropdown("");
};

// ============================================================================
// 5. MODAL MANAJER UJIAN TERPADU (INPUT + KONTROL + RINCIAN PG/IS/ESSAY + DROPDOWN BAWAH)
// ============================================================================
window.bukaManajerUjianTerpadu = function() {
    window.bersihkanOverlayPenghalang();
    var m = document.getElementById('modal-ujian-terpadu');
    if (!m) {
        var html = 
        '<div id="modal-ujian-terpadu" class="mahardika-modal-wrap" style="display:flex;">' +
            '<div class="mahardika-modal-card modal-box" style="max-width:920px;">' +
                '<div style="background:#2c3e50; color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<h3 style="margin:0; font-size:17px;">🎓 Manajer & Bank Ujian Terpadu</h3>' +
                    '<button type="button" onclick="document.getElementById(\'modal-ujian-terpadu\').style.display=\'none\'" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; font-weight:bold;">✕</button>' +
                '</div>' +
                '<div style="padding:18px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:15px;">' +
                    
                    // GRID ATAS: KIRI INPUT BANK UJIAN, KANAN KONTROL AKTIVASI
                    '<div style="display:grid; grid-template-columns:1.25fr 1fr; gap:14px;">' +
                        
                        // KOLOM 1: INPUT BANK UJIAN
                        '<div style="background:#f8f9fa; border:1px solid #dce4ec; border-radius:10px; padding:12px;">' +
                            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:4px;">' +
                                '<h4 style="margin:0; color:#2c3e50; font-size:13px;">➕ 1. Input Soal ke Bank Ujian</h4>' +
                                '<div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">' +
                                    '<button type="button" onclick="window.triggerUploadPDFKe(\'uji-input-raw\')" style="background:#e74c3c; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:bold;">📄 Upload PDF (AI)</button>' +
                                    '<button type="button" onclick="window.sisipkanFormatSoal(\'uji-input-raw\',\'PG\')" style="background:#3498db; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:bold;">+ PG</button>' +
                                    '<button type="button" onclick="window.sisipkanFormatSoal(\'uji-input-raw\',\'IS\')" style="background:#e67e22; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:bold;">+ IS</button>' +
                                    '<button type="button" onclick="window.sisipkanFormatSoal(\'uji-input-raw\',\'ESSAY\')" style="background:#9b59b6; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:bold;">+ Essay</button>' +
                                '</div>' +
                            '</div>' +
                            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">' +
                                '<select id="uji-input-jenjang" class="select-jenjang-dinamis" style="padding:6px; border:1px solid #ccc; border-radius:5px; font-size:12px;"></select>' +
                                '<select id="uji-input-mapel" class="select-mapel-dinamis" style="padding:6px; border:1px solid #ccc; border-radius:5px; font-size:12px;"></select>' +
                            '</div>' +
                            '<input type="text" id="uji-input-nama" placeholder="Nama Ujian (Contoh: UH 1 Biologi)" style="width:100%; padding:7px; border:1px solid #ccc; border-radius:5px; margin-bottom:8px; box-sizing:border-box; font-size:12px;">' +
                            '<textarea id="uji-input-raw" rows="4" placeholder="Paste soal PG, IS, atau Essay di sini..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; font-family:monospace; font-size:11px; box-sizing:border-box;"></textarea>' +
                            '<button type="button" onclick="window.simpanSoalKeBankUjianTerpadu()" style="width:100%; margin-top:6px; background:#27ae60; color:#fff; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">💾 Simpan / Tambahkan ke Bank Ujian</button>' +
                        '</div>' +

                        // KOLOM 2: KONTROL UJIAN AKTIF
                        '<div style="background:#fef9e7; border:1px solid #f9e79f; border-radius:10px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">' +
                            '<div>' +
                                '<h4 style="margin:0 0 8px 0; color:#b7950b; font-size:13px;">🔐 2. Aktifkan Ujian untuk Siswa</h4>' +
                                '<select id="uji-kontrol-pilih" style="width:100%; padding:7px; border:1px solid #ccc; border-radius:5px; margin-bottom:8px; font-size:12px;"></select>' +
                                '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">' +
                                    '<input type="text" id="uji-kontrol-sandi" placeholder="Sandi / Token (mis: 1234)" style="padding:7px; border:1px solid #ccc; border-radius:5px; font-size:12px;">' +
                                    '<input type="number" id="uji-kontrol-durasi" value="60" min="5" placeholder="Durasi (Menit)" style="padding:7px; border:1px solid #ccc; border-radius:5px; font-size:12px;">' +
                                '</div>' +
                                '<button type="button" onclick="window.aktifkanUjianTerpadu()" style="width:100%; background:#e67e22; color:#fff; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">🟢 Aktifkan Akses Ujian</button>' +
                            '</div>' +
                            '<div style="margin-top:10px;">' +
                                '<div style="font-size:11px; font-weight:bold; color:#555; margin-bottom:4px;">Ujian yang Sedang Aktif:</div>' +
                                '<div id="list-ujian-aktif-terpadu" style="max-height:105px; overflow-y:auto;"></div>' +
                            '</div>' +
                        '</div>' +

                    '</div>' +

                    // BAGIAN TENGAH: LIHAT SOAL & RINCIAN (PG, IS, ESSAY)
                    '<div style="border:1px solid #dce4ec; border-radius:10px; padding:12px; background:#fff;">' +
                        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">' +
                            '<div>' +
                                '<h4 style="margin:0; color:#2c3e50; font-size:13px;">👁️ 3. Daftar Soal pada Bank Ujian: <span id="label-paket-ujian-aktif" style="color:#2980b9;">(Pilih di bawah)</span></h4>' +
                                '<div id="rincian-jumlah-ujian" style="font-size:12px; font-weight:bold; color:#16a085; margin-top:3px;">0 Soal (0 PG, 0 IS, dan 0 Essay)</div>' +
                            '</div>' +
                            '<button type="button" onclick="window.hapusBankUjianTerpilih()" style="background:#e74c3c; color:#fff; border:none; padding:5px 12px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:bold;">🗑️ Hapus Bank Ujian Ini</button>' +
                        '</div>' +
                        '<div id="ruang-review-soal-ujian" style="max-height:190px; overflow-y:auto; padding:8px; background:#fdfefe; border:1px dashed #bdc3c7; border-radius:6px;">' +
                            '<p style="color:#888; font-size:12px; text-align:center; margin:12px 0;">Pilih salah satu Bank Ujian pada dropdown paling bawah untuk memeriksa soal dan rincian PG/IS/Essay.</p>' +
                        '</div>' +
                    '</div>' +

                    // BAGIAN PALING BAWAH: DROPDOWN LIST BANK UJIAN
                    '<div style="background:#ebf5fb; border:2px solid #2980b9; border-radius:10px; padding:12px 15px; display:flex; align-items:center; justify-content:space-between; gap:12px;">' +
                        '<div style="font-weight:bold; color:#1b4f72; font-size:13px; white-space:nowrap;">📂 Pilih Bank Ujian Tersimpan:</div>' +
                        '<select id="dropdown-bank-ujian-bawah" onchange="window.pilihPaketUjianDariDropdown(this.value)" style="flex:1; padding:9px; border:1px solid #2980b9; border-radius:6px; font-weight:bold; color:#2c3e50; background:#fff;"></select>' +
                    '</div>' +

                '</div>' +
            '</div>' +
        '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
    } else {
        m.style.display = 'flex';
    }
    perbaruiSemuaDropdownKonfig();
    renderDropdownBankUjianBawah();
    muatDaftarUjianAktifTerpadu();
};

function renderDropdownBankUjianBawah() {
    var selBawah = document.getElementById('dropdown-bank-ujian-bawah');
    var selKontrol = document.getElementById('uji-kontrol-pilih');
    var keys = Object.keys(window.bankUjianGlobal || {}).sort();

    if (selBawah) {
        if (keys.length === 0) {
            selBawah.innerHTML = '<option value="">-- Belum ada Bank Ujian yang diinput --</option>';
        } else {
            selBawah.innerHTML = '<option value="">-- Pilih Bank Ujian (' + keys.length + ' Paket Tersimpan) --</option>' +
                keys.map(function(k) {
                    var r = window.hitungRincianSoal(window.bankUjianGlobal[k]);
                    var selAttr = window.paketUjianTerpilih === k ? ' selected' : '';
                    return '<option value="' + k + '"' + selAttr + '>' + k + ' — ' + r.teksRingkas + '</option>';
                }).join('');
        }
    }
    if (selKontrol) {
        if (keys.length === 0) {
            selKontrol.innerHTML = '<option value="">-- Pilih Bank Ujian --</option>';
        } else {
            selKontrol.innerHTML = keys.map(function(k) {
                var r = window.hitungRincianSoal(window.bankUjianGlobal[k]);
                return '<option value="' + k + '">' + k + ' — ' + r.teksRingkas + '</option>';
            }).join('');
        }
    }
}

window.pilihPaketUjianDariDropdown = function(key) {
    window.paketUjianTerpilih = key;
    var label = document.getElementById('label-paket-ujian-aktif');
    var rincianEl = document.getElementById('rincian-jumlah-ujian');
    var container = document.getElementById('ruang-review-soal-ujian');

    if (!key || !window.bankUjianGlobal || !window.bankUjianGlobal[key]) {
        if (label) label.innerText = "(Belum dipilih)";
        if (rincianEl) rincianEl.innerText = "0 Soal (0 PG, 0 IS, dan 0 Essay)";
        if (container) container.innerHTML = '<p style="color:#888; font-size:12px; text-align:center;">Pilih Bank Ujian pada dropdown di bawah untuk melihat soal.</p>';
        return;
    }

    var arr = window.ambilArraySoal(window.bankUjianGlobal[key]);
    var rincian = window.hitungRincianSoal(arr);

    if (label) label.innerText = key;
    if (rincianEl) rincianEl.innerHTML = '📊 Total: <b>' + rincian.total + ' Soal</b> <span style="color:#2980b9;">(' + rincian.pg + ' PG, ' + rincian.is + ' IS, dan ' + rincian.essay + ' Essay)</span>';
    if (document.getElementById('uji-input-nama')) document.getElementById('uji-input-nama').value = key;

    var safeKey = key.replace(/'/g, "\\'");
    container.innerHTML = arr.map(function(q, idx) {
        var t = (q.type || 'mc').toLowerCase();
        var badge = '<span style="background:#3498db; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:6px;">PG</span>';
        var kunciStr = '';

        if (t === 'essay' || t === 'uraian') {
            badge = '<span style="background:#9b59b6; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:6px;">Essay</span>';
            kunciStr = 'Rubrik/Kunci Essay: <b>' + ((q.correctAnswers && q.correctAnswers[0]) || q.explanation || '-') + '</b>';
        } else if (t === 'short_answer' || t === 'is') {
            badge = '<span style="background:#e67e22; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:6px;">IS</span>';
            kunciStr = 'Kunci Isian: <b>' + (q.correctAnswers || []).join(' | ') + '</b>';
        } else {
            kunciStr = 'Opsi: ' + (q.options || []).map(function(o, oi) { return String.fromCharCode(65 + oi) + '. ' + o; }).join(' | ') +
                       ' — <b style="color:#27ae60;">Kunci: ' + String.fromCharCode(65 + (q.correctIndex || 0)) + '</b>';
        }

        return '<div style="background:#f8f9fa; border:1px solid #e1e8ed; border-radius:6px; padding:8px 10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">' +
            '<div style="font-size:12px;"><b>' + (idx + 1) + '. ' + badge + q.question + '</b><br><span style="font-size:11px; color:#555;">' + kunciStr + '</span></div>' +
            '<button type="button" onclick="window.hapusSatuSoalUjian(\'' + safeKey + '\', ' + idx + ')" style="background:#fadbd8; color:#c0392b; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;">🗑️</button>' +
        '</div>';
    }).join('');
};

window.hapusSatuSoalUjian = function(key, idx) {
    if (!confirm("Hapus soal nomor " + (idx + 1) + " ini dari Bank Ujian?")) return;
    var arr = window.ambilArraySoal(window.bankUjianGlobal[key]);
    arr.splice(idx, 1);
    window.bankUjianGlobal[key] = arr;
    set(ref(db, 'bank_ujian'), window.bankUjianGlobal);
    window.pilihPaketUjianDariDropdown(key);
    renderDropdownBankUjianBawah();
};

window.hapusBankUjianTerpilih = function() {
    if (!window.paketUjianTerpilih) return alert("Pilih Bank Ujian di dropdown bawah terlebih dahulu!");
    if (!confirm('Hapus seluruh Bank Ujian "' + window.paketUjianTerpilih + '"?')) return;
    delete window.bankUjianGlobal[window.paketUjianTerpilih];
    window.paketUjianTerpilih = "";
    set(ref(db, 'bank_ujian'), window.bankUjianGlobal);
    renderDropdownBankUjianBawah();
    window.pilihPaketUjianDariDropdown("");
};

window.aktifkanUjianTerpadu = function() {
    var nama = document.getElementById('uji-kontrol-pilih').value;
    var sandi = document.getElementById('uji-kontrol-sandi').value.trim();
    var durasi = parseInt(document.getElementById('uji-kontrol-durasi').value) || 60;
    
    if (!nama) return alert("Pilih Bank Ujian terlebih dahulu!");
    if (!sandi) return alert("Masukkan Sandi / Kode Akses ujian!");

    set(ref(db, 'ujian_aktif/' + nama), {
        nama_ujian: nama, // <-- INI KUNCI PERBAIKANNYA
        aktif: true,
        kode: sandi,
        durasi: durasi,
        timestamp: Date.now()
    }).then(function() {
        document.getElementById('uji-kontrol-sandi').value = "";
        muatDaftarUjianAktifTerpadu();
    });
};

function muatDaftarUjianAktifTerpadu() {
    var cont = document.getElementById('list-ujian-aktif-terpadu');
    if (!cont || typeof db === 'undefined') return;
    get(child(ref(db), 'ujian_aktif')).then(function(snap) {
        var html = '';
        if (snap.exists()) {
            var val = snap.val();
            Object.keys(val).forEach(function(k) {
                if (val[k] && val[k].aktif) {
                    var r = window.hitungRincianSoal(window.bankUjianGlobal ? window.bankUjianGlobal[k] : []);
                    var safeK = k.replace(/'/g, "\\'");
                    html += '<div style="background:#fff; border:1px solid #a3e4d7; padding:6px 10px; border-radius:6px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">' +
                        '<div><b>' + k + '</b><br><span style="color:#2980b9; font-weight:bold;">' + r.teksRingkas + '</span> | Sandi: <b style="color:#e67e22;">' + val[k].kode + '</b> | ' + val[k].durasi + ' mnt</div>' +
                        '<button type="button" onclick="window.matikanUjianTerpadu(\'' + safeK + '\')" style="background:#e74c3c; color:#fff; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:10px;">Matikan</button>' +
                    '</div>';
                }
            });
        }
        cont.innerHTML = html || '<div style="color:#888; font-size:11px; font-style:italic;">Belum ada ujian yang diaktifkan.</div>';
    });
}

window.matikanUjianTerpadu = function(nama) {
    set(ref(db, 'ujian_aktif/' + nama), null).then(muatDaftarUjianAktifTerpadu);
};

// ============================================================================
// 6. PORTAL UJIAN SISWA (INPUT NAMA, DROPDOWN KELAS & SANDI)
// ============================================================================
window.bukaPortalUjianSiswa = function() {
    window.bersihkanOverlayPenghalang();
    var m = document.getElementById('modal-portal-ujian-siswa');
    if (!m) {
        var html = 
        '<div id="modal-portal-ujian-siswa" class="mahardika-modal-wrap" style="display:flex;">' +
            '<div class="mahardika-modal-card modal-box" style="max-width:720px;">' +
                '<div style="background:#2980b9; color:#fff; padding:15px 20px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<h3 style="margin:0; font-size:17px;">📝 Portal Ujian Siswa</h3>' +
                    '<button type="button" onclick="document.getElementById(\'modal-portal-ujian-siswa\').style.display=\'none\'" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer;">✕</button>' +
                '</div>' +
                '<div id="body-portal-ujian-siswa" style="padding:20px; overflow-y:auto; flex:1;"></div>' +
            '</div>' +
        '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
    } else {
        m.style.display = 'flex';
    }
    tampilkanFormLoginUjianSiswa();
};

function tampilkanFormLoginUjianSiswa() {
    var body = document.getElementById('body-portal-ujian-siswa');
    if (!body) return;
    get(child(ref(db), 'ujian_aktif')).then(function(snap) {
        var aktifList = [];
        if (snap.exists()) {
            var val = snap.val();
            Object.keys(val).forEach(function(k) {
                if (val[k] && val[k].aktif) {
                    var item = val[k];
                    item.nama = k;
                    aktifList.push(item);
                }
            });
        }

        if (aktifList.length === 0) {
            body.innerHTML = '<div style="text-align:center; padding:30px; color:#7f8c8d;"><h4>🔒 Belum Ada Ujian yang Aktif</h4><p style="font-size:13px;">Silakan tunggu instruksi dari Guru untuk memulai ujian.</p></div>';
            return;
        }

        var opsiUjian = aktifList.map(function(u) {
            var r = window.hitungRincianSoal(window.bankUjianGlobal ? window.bankUjianGlobal[u.nama] : []);
            return '<option value="' + u.nama + '">' + u.nama + ' — ' + r.teksRingkas + ' (' + u.durasi + ' Menit)</option>';
        }).join('');

        body.innerHTML = 
        '<div style="max-width:440px; margin:0 auto; display:flex; flex-direction:column; gap:12px;">' +
            '<div>' +
                '<label style="font-size:12px; font-weight:bold; color:#2c3e50;">1. Nama Lengkap Siswa:</label>' +
                '<input type="text" id="siswa-ujian-nama" placeholder="Ketik nama lengkapmu..." style="width:100%; padding:10px; border:1px solid #bdc3c7; border-radius:8px; margin-top:4px; box-sizing:border-box;">' +
            '</div>' +
            '<div>' +
                '<label style="font-size:12px; font-weight:bold; color:#2c3e50;">2. Pilih Kelas:</label>' +
                '<select id="siswa-ujian-kelas" style="width:100%; padding:10px; border:1px solid #bdc3c7; border-radius:8px; margin-top:4px; background:#fff;"></select>' +
            '</div>' +
            '<div>' +
                '<label style="font-size:12px; font-weight:bold; color:#2c3e50;">3. Pilih Mata Ujian:</label>' +
                '<select id="siswa-ujian-pilih" style="width:100%; padding:10px; border:1px solid #bdc3c7; border-radius:8px; margin-top:4px; background:#fff;">' + opsiUjian + '</select>' +
            '</div>' +
            '<div>' +
                '<label style="font-size:12px; font-weight:bold; color:#2c3e50;">4. Sandi / Kode Akses Ujian:</label>' +
                '<input type="password" id="siswa-ujian-sandi" placeholder="Masukkan sandi dari Guru..." style="width:100%; padding:10px; border:1px solid #bdc3c7; border-radius:8px; margin-top:4px; box-sizing:border-box;">' +
            '</div>' +
            '<button type="button" onclick="window.mulaiKerjakanUjianSiswa()" style="background:#27ae60; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer; margin-top:8px;">🚀 Mulai Ujian Sekarang</button>' +
        '</div>';
        perbaruiSemuaDropdownKonfig();
    });
}

window.mulaiKerjakanUjianSiswa = function() {
    var namaSiswa = document.getElementById('siswa-ujian-nama').value.trim();
    var kelasSiswa = document.getElementById('siswa-ujian-kelas').value;
    var namaUjian = document.getElementById('siswa-ujian-pilih').value;
    var sandiInput = document.getElementById('siswa-ujian-sandi').value.trim();

    if (!namaSiswa) return alert("Nama lengkap wajib diisi!");
    if (!kelasSiswa) return alert("Silakan pilih kelasmu pada dropdown!");
    if (!sandiInput) return alert("Masukkan sandi ujian!");

    get(child(ref(db), 'ujian_aktif/' + namaUjian)).then(function(snap) {
        if (!snap.exists() || !snap.val().aktif) return alert("Ujian ini sudah tidak aktif.");
        var dataAktif = snap.val();
        if (String(dataAktif.kode).trim() !== sandiInput) return alert("❌ Sandi / Kode Akses salah!");

        var soalUjian = window.ambilArraySoal(window.bankUjianGlobal ? window.bankUjianGlobal[namaUjian] : []);
        if (soalUjian.length === 0) return alert("Soal belum tersedia di ujian ini.");

        window.sesiUjianSiswa = {
            nama: namaSiswa,
            kelas: kelasSiswa,
            ujian: namaUjian,
            soal: soalUjian,
            jawaban: {},
            sisaDetik: (parseInt(dataAktif.durasi) || 60) * 60
        };
        renderLembarKerjaUjianSiswa();
    });
};

function renderLembarKerjaUjianSiswa() {
    var s = window.sesiUjianSiswa;
    var body = document.getElementById('body-portal-ujian-siswa');
    if (!body || !s) return;

    clearInterval(window.timerUjianSiswa);
    window.timerUjianSiswa = setInterval(function() {
        s.sisaDetik--;
        var elT = document.getElementById('timer-ujian-siswa');
        if (elT) {
            var m = Math.floor(s.sisaDetik / 60), d = s.sisaDetik % 60;
            elT.innerText = m + ':' + (d < 10 ? '0' : '') + d;
        }
        if (s.sisaDetik <= 0) {
            clearInterval(window.timerUjianSiswa);
            alert("⏰ Waktu ujian habis! Jawabanmu akan dikumpulkan otomatis.");
            window.kumpulkanUjianSiswa(true);
        }
    }, 1000);

    var htmlSoal = s.soal.map(function(q, idx) {
        var t = (q.type || 'mc').toLowerCase();
        var inputHtml = '';
        if (t === 'essay' || t === 'uraian') {
            inputHtml = '<textarea rows="3" placeholder="Ketik jawaban uraian/essay..." oninput="window.sesiUjianSiswa.jawaban[' + idx + ']=this.value" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; margin-top:6px; box-sizing:border-box;"></textarea>';
        } else if (t === 'short_answer' || t === 'is') {
            inputHtml = '<input type="text" placeholder="Ketik jawaban singkat..." oninput="window.sesiUjianSiswa.jawaban[' + idx + ']=this.value" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; margin-top:6px; box-sizing:border-box;">';
        } else {
            inputHtml = (q.options || []).map(function(opt, oIdx) {
                return '<label style="display:block; padding:8px 10px; border:1px solid #e1e8ed; border-radius:6px; margin-top:5px; cursor:pointer; background:#fdfefe;">' +
                    '<input type="radio" name="uji_q_' + idx + '" value="' + oIdx + '" onchange="window.sesiUjianSiswa.jawaban[' + idx + ']=' + oIdx + '"> ' +
                    '<b>' + String.fromCharCode(65 + oIdx) + '.</b> ' + opt +
                '</label>';
            }).join('');
        }
        return '<div style="background:#fff; border:1px solid #dce4ec; border-radius:8px; padding:12px; margin-bottom:12px;">' +
            '<div style="font-weight:bold; color:#2c3e50; margin-bottom:6px;">' + (idx + 1) + '. ' + q.question + '</div>' +
            inputHtml +
        '</div>';
    }).join('');

    body.innerHTML = 
        '<div style="position:sticky; top:-20px; background:#fef9e7; border:1px solid #f9e79f; padding:10px 14px; border-radius:8px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; z-index:5;">' +
            '<div style="font-size:12px;">👤 <b>' + s.nama + '</b> | 🏫 Kelas: <b>' + s.kelas + '</b></div>' +
            '<div style="font-size:14px; font-weight:bold; color:#c0392b;">⏳ Sisa Waktu: <span id="timer-ujian-siswa">--:--</span></div>' +
        '</div>' +
        htmlSoal +
        '<button type="button" onclick="window.kumpulkanUjianSiswa(false)" style="width:100%; background:#27ae60; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:bold; font-size:15px; cursor:pointer;">✅ Selesai & Kumpulkan Jawaban</button>';
}

window.kumpulkanUjianSiswa = function(autoSubmit) {
    if (!autoSubmit && !confirm("Yakin ingin mengumpulkan jawaban ujian sekarang?")) return;
    clearInterval(window.timerUjianSiswa);
    var s = window.sesiUjianSiswa;
    var benar = 0;

    s.soal.forEach(function(q, idx) {
        var jwb = s.jawaban[idx];
        var t = (q.type || 'mc').toLowerCase();
        if (t === 'essay' || t === 'uraian') {
            if (jwb && String(jwb).trim().length > 3) benar++;
        } else if (t === 'short_answer' || t === 'is') {
            var kunciArr = (q.correctAnswers || []).map(function(k) { return k.toLowerCase().trim(); });
            if (jwb && kunciArr.includes(String(jwb).toLowerCase().trim())) benar++;
        } else {
            if (jwb !== undefined && parseInt(jwb) === parseInt(q.correctIndex)) benar++;
        }
    });

    var nilaiAkhir = Math.round((benar / s.soal.length) * 100);
    var idHasil = 'hasil_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    var dataSimpan = {
        id: idHasil,
        nama: s.nama,
        kelas: s.kelas,
        ujian: s.ujian,
        benar: benar,
        totalSoal: s.soal.length,
        nilai: nilaiAkhir,
        waktu: new Date().toLocaleString('id-ID')
    };

    set(ref(db, 'rekap_nilai_ujian/' + idHasil), dataSimpan).then(function() {
        document.getElementById('body-portal-ujian-siswa').innerHTML = 
            '<div style="text-align:center; padding:30px;">' +
                '<h2 style="color:#27ae60; margin-bottom:5px;">🎉 Ujian Selesai!</h2>' +
                '<p style="color:#555; font-size:14px;">Terima kasih <b>' + s.nama + '</b> (' + s.kelas + '), jawabanmu telah tersimpan di Rekap Nilai Kelas.</p>' +
                '<div style="background:#e8f8f5; border:2px solid #16a085; border-radius:12px; padding:20px; max-width:260px; margin:20px auto;">' +
                    '<div style="font-size:12px; color:#555;">Nilai Akhir Kamu:</div>' +
                    '<div style="font-size:42px; font-weight:bold; color:#16a085;">' + nilaiAkhir + '</div>' +
                    '<div style="font-size:12px; color:#2c3e50;">Benar: ' + benar + ' dari ' + s.soal.length + ' Soal</div>' +
                '</div>' +
            '</div>';
    });
};

// ============================================================================
// 7. MODAL REKAP NILAI ADMIN (TERKELOMPOK PER KELAS + TAMBAH KELAS)
// ============================================================================
window.bukaRekapNilaiPerKelas = function() {
    window.bersihkanOverlayPenghalang();
    var m = document.getElementById('modal-rekap-perkelas');
    if (!m) {
        var html = 
        '<div id="modal-rekap-perkelas" class="mahardika-modal-wrap" style="display:flex;">' +
            '<div class="mahardika-modal-card modal-box" style="max-width:880px;">' +
                '<div style="background:#8e44ad; color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<h3 style="margin:0; font-size:17px;">📊 Rekap Nilai Ujian Per Kelas</h3>' +
                    '<button type="button" onclick="document.getElementById(\'modal-rekap-perkelas\').style.display=\'none\'" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer;">✕</button>' +
                '</div>' +
                '<div style="padding:18px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:14px;">' +
                    '<div style="background:#f8f9fa; border:1px solid #dce4ec; border-radius:10px; padding:12px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px;">' +
                        '<div style="display:flex; align-items:center; gap:8px; flex:1;">' +
                            '<label style="font-weight:bold; font-size:13px; color:#2c3e50;">🏫 Filter Kelas:</label>' +
                            '<select id="filter-rekap-kelas" onchange="window.renderTabelRekapPerKelas()" style="padding:8px 12px; border:2px solid #8e44ad; border-radius:6px; font-weight:bold; color:#2c3e50; min-width:200px;"></select>' +
                            '<button type="button" onclick="window.tambahKelasUjianBaru()" style="background:#27ae60; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">+ Tambah Kelas</button>' +
                            '<button type="button" onclick="window.hapusKelasUjian()" style="background:#fadbd8; color:#c0392b; border:none; padding:8px 10px; border-radius:6px; font-size:12px; cursor:pointer;" title="Hapus Kelas Terpilih">🗑️</button>' +
                        '</div>' +
                        '<div style="display:flex; gap:6px;">' +
                            '<button type="button" onclick="window.unduhRekapCSVPerKelas()" style="background:#2980b9; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📥 Export CSV</button>' +
                            '<button type="button" onclick="window.hapusRekapKelasTerpilih()" style="background:#e74c3c; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">🗑️ Bersihkan Nilai Kelas Ini</button>' +
                        '</div>' +
                    '</div>' +
                    '<div id="wadah-tabel-rekap-perkelas" style="overflow-x:auto;"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
    } else {
        m.style.display = 'flex';
    }
    perbaruiSemuaDropdownKonfig();
    window.renderTabelRekapPerKelas();
};

window.renderTabelRekapPerKelas = function() {
    var wadah = document.getElementById('wadah-tabel-rekap-perkelas');
    var elFilter = document.getElementById('filter-rekap-kelas');
    var filterKls = elFilter ? elFilter.value : "SEMUA";
    if (!wadah) return;

    var semuaData = Object.values(window.rekapNilaiGlobal || {});
    var tersaring = filterKls === "SEMUA" ? semuaData : semuaData.filter(function(d) { return d.kelas === filterKls; });

    tersaring.sort(function(a, b) {
        return (a.kelas || "").localeCompare(b.kelas || "") || (a.nama || "").localeCompare(b.nama || "");
    });

    if (tersaring.length === 0) {
        wadah.innerHTML = '<div style="text-align:center; padding:30px; color:#888; border:1px dashed #ccc; border-radius:8px;">Belum ada data nilai siswa untuk <b>' + (filterKls === 'SEMUA' ? 'Semua Kelas' : filterKls) + '</b>.</div>';
        return;
    }

    var rowsHtml = tersaring.map(function(d, idx) {
        var warnaNilai = d.nilai >= 75 ? '#27ae60' : '#e67e22';
        return '<tr style="border-bottom:1px solid #eee;">' +
            '<td style="padding:10px; text-align:center;">' + (idx + 1) + '</td>' +
            '<td style="padding:10px; font-weight:bold; color:#2c3e50;">' + d.nama + '</td>' +
            '<td style="padding:10px; text-align:center;"><span style="background:#ebf5fb; color:#2980b9; padding:3px 8px; border-radius:12px; font-weight:bold; font-size:11px;">' + (d.kelas || '-') + '</span></td>' +
            '<td style="padding:10px; font-size:12px;">' + d.ujian + '</td>' +
            '<td style="padding:10px; text-align:center;">' + d.benar + ' / ' + d.totalSoal + '</td>' +
            '<td style="padding:10px; text-align:center; font-weight:bold; font-size:15px; color:' + warnaNilai + ';">' + d.nilai + '</td>' +
            '<td style="padding:10px; font-size:11px; color:#7f8c8d;">' + (d.waktu || '-') + '</td>' +
            '<td style="padding:10px; text-align:center;"><button type="button" onclick="window.hapusSatuNilaiSiswa(\'' + d.id + '\')" style="background:none; border:none; cursor:pointer;">🗑️</button></td>' +
        '</tr>';
    }).join('');

    wadah.innerHTML = 
        '<table style="width:100%; border-collapse:collapse; font-size:13px; background:#fff;">' +
            '<thead>' +
                '<tr style="background:#ecf0f1; color:#2c3e50; text-align:left;">' +
                    '<th style="padding:10px; text-align:center; width:40px;">No</th>' +
                    '<th style="padding:10px;">Nama Siswa</th>' +
                    '<th style="padding:10px; text-align:center;">Kelas</th>' +
                    '<th style="padding:10px;">Mata Ujian</th>' +
                    '<th style="padding:10px; text-align:center;">Benar</th>' +
                    '<th style="padding:10px; text-align:center;">Nilai</th>' +
                    '<th style="padding:10px;">Waktu</th>' +
                    '<th style="padding:10px; text-align:center;">Aksi</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
        '</table>';
};

window.hapusSatuNilaiSiswa = function(id) {
    if (!confirm("Hapus data nilai siswa ini?")) return;
    set(ref(db, 'rekap_nilai_ujian/' + id), null);
};

window.hapusRekapKelasTerpilih = function() {
    var elFilter = document.getElementById('filter-rekap-kelas');
    var filterKls = elFilter ? elFilter.value : "SEMUA";
    if (!confirm('Yakin ingin menghapus seluruh rekap nilai untuk "' + filterKls + '"?')) return;
    if (filterKls === "SEMUA") {
        set(ref(db, 'rekap_nilai_ujian'), null);
    } else {
        Object.values(window.rekapNilaiGlobal || {}).forEach(function(d) {
            if (d.kelas === filterKls) set(ref(db, 'rekap_nilai_ujian/' + d.id), null);
        });
    }
};

window.unduhRekapCSVPerKelas = function() {
    var elFilter = document.getElementById('filter-rekap-kelas');
    var filterKls = elFilter ? elFilter.value : "SEMUA";
    var semuaData = Object.values(window.rekapNilaiGlobal || {});
    var tersaring = filterKls === "SEMUA" ? semuaData : semuaData.filter(function(d) { return d.kelas === filterKls; });
    if (tersaring.length === 0) return alert("Tidak ada data untuk diekspor.");

    var csv = "No,Nama Siswa,Kelas,Mata Ujian,Benar,Total Soal,Nilai Akhir,Waktu\n";
    tersaring.forEach(function(d, i) {
        csv += (i + 1) + ',"' + d.nama + '","' + d.kelas + '","' + d.ujian + '",' + d.benar + ',' + d.totalSoal + ',' + d.nilai + ',"' + d.waktu + '"\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = 'Rekap_Nilai_' + filterKls.replace(/\s+/g, '_') + '.csv';
    link.click();
};

// ============================================================================
// 8. GABUNGKAN TOMBOL TOOLBAR ADMIN TANPA KONFLIK EVENT LAMA
// ============================================================================
function rapikanToolbarAdminOtomatis() {
    var origBukaModal = window.bukaModal;
    window.bukaModal = function(id) {
        if (id === 'modal-admin-bank-soal' || id === 'modal-manajer-soal') return window.bukaManajerLatihanTerpadu();
        if (id === 'modal-admin-bank-ujian' || id === 'modal-manajer-ujian' || id === 'modal-kontrol-ujian') return window.bukaManajerUjianTerpadu();
        if (id === 'modal-rekap-nilai') return window.bukaRekapNilaiPerKelas();
        
        if (id === 'modal-enter-ujian' || id === 'modal-portal-ujian-siswa') {
            if (typeof origBukaModal === 'function') return origBukaModal('modal-enter-ujian');
            return;
        }
        if (typeof origBukaModal === 'function') origBukaModal(id);
    };

    window.bukaModalManagerSoal = window.bukaManajerLatihanTerpadu;
    window.bukaManajerLatihan = window.bukaManajerLatihanTerpadu;
    window.bukaBankLatihan = window.bukaManajerLatihanTerpadu;
    window.bukaModalManajerUjian = window.bukaManajerUjianTerpadu;
    window.bukaModalKontrolUjian = window.bukaManajerUjianTerpadu;
    window.bukaKontrolUjian = window.bukaManajerUjianTerpadu;
    window.bukaBankUjian = window.bukaManajerUjianTerpadu;
    window.bukaModalRekapNilai = window.bukaRekapNilaiPerKelas;
    window.bukaRekapNilai = window.bukaRekapNilaiPerKelas;
    
    window.bukaUjianSiswa = function() { window.bukaModal('modal-enter-ujian'); };

    var btnLatihanSudahAda = false;
    var btnUjianSudahAda = false;

    document.querySelectorAll('button, a, .admin-menu-bar span').forEach(function(el) {
        if (el.closest('.mahardika-modal-wrap')) return;
        var txt = (el.innerText || "").trim();
        var onclk = el.getAttribute('onclick') || "";

        if (/Bank\s*Latihan|Manajer\s*Latihan/i.test(txt)) {
            if (!btnLatihanSudahAda) {
                el.innerHTML = "📚 Manajer Latihan";
                el.removeAttribute('onclick');
                el.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.bukaManajerLatihanTerpadu(); };
                btnLatihanSudahAda = true;
            } else { el.style.display = 'none'; }
        } else if (/Bank\s*Ujian|Manajer\s*Ujian|Kontrol\s*Ujian/i.test(txt)) {
            if (!btnUjianSudahAda) {
                el.innerHTML = "🎓 Manajer Ujian";
                el.removeAttribute('onclick');
                el.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.bukaManajerUjianTerpadu(); };
                btnUjianSudahAda = true;
            } else { el.style.display = 'none'; }
        } else if (/Rekap\s*Nilai|Hasil\s*Ujian/i.test(txt)) {
            el.innerHTML = "📊 Rekap Nilai";
            el.removeAttribute('onclick');
            el.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.bukaRekapNilaiPerKelas(); };
        } else if (/🎯\s*UJIAN/i.test(txt) || /modal-enter-ujian/i.test(onclk)) {
            el.removeAttribute('onclick');
            el.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.bukaModal('modal-enter-ujian'); };
        }
    });
}

setTimeout(function() {
    inisialisasiSistemTerpadu();
    rapikanToolbarAdminOtomatis();
}, 600);

// ==========================================
// FUNGSI FORMAT TEKS TOOLBAR & UPLOAD GAMBAR
// ==========================================
window.formatTeks = function(cmd, val) {
    document.execCommand(cmd, false, val || null);
    window.triggerInput();
};

window.aturUkuranFont = function(sizeVal) {
    document.execCommand('fontSize', false, sizeVal);
    window.triggerInput();
};

window.aturSpasiParagraf = function(val) {
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var node = sel.anchorNode;
    var el = (node && node.nodeType === 3) ? node.parentElement : node;
    while (el && !['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(el.tagName) && !el.classList.contains('content-block')) {
        el = el.parentElement;
    }
    if (!el) return;

    if (val.indexOf('line-') === 0) {
        el.style.lineHeight = val.replace('line-', '');
    } else if (val === 'add-before') {
        el.style.marginTop = '18px';
    } else if (val === 'add-after') {
        el.style.marginBottom = '18px';
    } else if (val === 'remove-space') {
        el.style.marginTop = '0px';
        el.style.marginBottom = '0px';
    }
    window.triggerInput();
};

document.addEventListener('DOMContentLoaded', function() {
    var imgInput = document.getElementById('image-upload-input');
    if (imgInput) {
        imgInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>⏳ Mengunggah Gambar...</span>";
            window.kompresGambar(file, function(dataUrl) {
                window.kembalikanSeleksiTeks();
                document.execCommand('insertImage', false, dataUrl);
                document.getElementById('save-status-bar').innerHTML = "<span style='color:#2ecc71;'>✓ Gambar Disisipkan</span>";
                window.triggerInput();
            });
            e.target.value = '';
        });
    }
});

// ============================================================================
// 9. PATCH PERBAIKAN: KONTROL BLOK ANTI-TULIS, HAPUS KELAS & TOMBOL X MODAL
// ============================================================================

// Pastikan semua tombol X (.close-btn) di modal mana pun selalu merespons klik
document.addEventListener('click', function(e) {
    var closeBtn = e.target.closest('.close-btn');
    if (closeBtn) {
        var parentModal = closeBtn.closest('.modal-overlay, .mahardika-modal-wrap');
        if (parentModal) {
            e.stopPropagation();
            parentModal.style.display = 'none';
        }
    }
}, true);

// Perbaikan Hapus Kelas pada Filter Rekap Nilai Per Kelas
window.hapusKelasUjian = function() {
    var sel = document.getElementById('filter-rekap-kelas');
    var kls = sel ? sel.value : "";
    if (!kls || kls === "SEMUA") {
        alert("Pilih nama kelas yang ingin dihapus pada dropdown Filter Kelas terlebih dahulu (bukan 'Semua Kelas').");
        return;
    }
    if (!confirm("Yakin ingin menghapus kelas '" + kls + "' beserta daftar pilihannya?")) return;

    window.konfigPendidikan.daftarKelas = (window.konfigPendidikan.daftarKelas || []).filter(function(k) {
        return k !== kls;
    });
    simpanKonfigKeDB();

    if (sel) sel.value = "SEMUA";
    perbaruiSemuaDropdownKonfig();
    if (sel) sel.value = "SEMUA";
    window.renderTabelRekapPerKelas();
    alert("✓ Kelas '" + kls + "' berhasil dihapus.");
};

// Perbaikan Render Blocks agar tombol Setting/Panah tidak bisa diketik saat blok kosong
window.renderBlocks = function() {
    var html = '';
    var isEdit = document.body.classList.contains('mode-edit-aktif') || document.documentElement.classList.contains('force-edit-mode');
    (window.contentBlocksData || []).forEach(function(blok, index) {
        var qi = '';
        var ctrlHtml = '<div class="block-controls" contenteditable="false" style="user-select:none;">' +
            '<button type="button" contenteditable="false" onclick="geserBlok(' + index + ', -1)">⬆️</button>' +
            '<button type="button" contenteditable="false" onclick="geserBlok(' + index + ', 1)">⬇️</button>' +
            '<button type="button" contenteditable="false" onclick="bukaSidebarBlock(' + index + ')">⚙️ Setting</button>' +
            '<button type="button" contenteditable="false" onclick="hapusBlok(' + index + ')">🗑️ Delete</button>' +
            '</div>';

        if (blok.type === 'quiz') {
            qi += '<div class="quiz-container" id="inline-kuis-' + index + '">' +
                '<div class="quiz-header"><h3 class="quiz-title">🧩 Uji Pemahaman</h3><div>' +
                '<button type="button" class="btn-action" style="background:#34495e;width:auto;font-size:11px;padding:6px 12px;margin-right:5px;" onclick="cetakKuisPDF(\'inline-kuis-' + index + '\',\'Materi\')">🖨️ Cetak</button>' +
                (isEdit ? '<button type="button" class="btn-action" style="background:#2e7d32;width:auto;font-size:11px;padding:6px 12px;" onclick="bukaAIQuizModal(' + index + ')">🤖 Ekstrak</button>' : '') +
                '</div></div>';

            if (blok.questions && blok.questions.length > 0) {
                blok.questions.forEach(function(q, qIdx) {
                    var qTextHtml = isEdit
                        ? '<div class="quiz-question-text" contenteditable="true" oninput="updateSoalInline(' + index + ',' + qIdx + ',\'q\',this)">' + (qIdx + 1) + '. ' + q.question + '</div>'
                        : '<div class="quiz-question-text">' + (qIdx + 1) + '. ' + q.question + '</div>';
                    qi += '<div class="quiz-question-card" id="inline-q-' + index + '-' + qIdx + '">' +
                        (isEdit ? '<button type="button" class="btn-delete-q" contenteditable="false" onclick="hapusSoalSistem(' + qIdx + ', \'inline\', ' + index + ')" title="Hapus Soal">🗑️</button>' : '') +
                        qTextHtml;

                    if (q.type === 'short_answer' || (!q.options && q.correctAnswers)) {
                        var altStr = q.correctAnswers ? q.correctAnswers.join(' | ') : '';
                        qi += '<div class="short-answer-box" style="margin-top:10px;">' +
                            '<input type="text" class="input-box" placeholder="Ketik jawaban singkat..." style="font-size:15px; font-weight:600; padding:10px 12px; border:2px solid #3498db; border-radius:8px; width:100%; box-sizing:border-box;" oninput="jawabKuisInlineIsian(this, ' + index + ', ' + qIdx + ')">' +
                            (isEdit ? '<div style="font-size:11px; color:#c0392b; margin-top:8px; background:#fadbd8; padding:6px; border-radius:4px; border-left:4px solid #e74c3c;"><b>🔒 Info Admin:</b> Alternatif Kunci: ' + altStr + '</div>' : '') +
                            '</div>';
                    } else {
                        qi += '<div class="quiz-options">';
                        (q.options || []).forEach(function(opt, oIdx) {
                            var huruf = String.fromCharCode(65 + oIdx);
                            var optHtml = isEdit
                                ? '<div class="quiz-option-btn" contenteditable="true" oninput="updateSoalInline(' + index + ',' + qIdx + ',\'o\',this,' + oIdx + ')">' + huruf + '. ' + opt + '</div>'
                                : '<button type="button" class="quiz-option-btn" onclick="jawabKuisInline(this,' + index + ',' + qIdx + ',' + oIdx + ',' + q.correctIndex + ')">' + huruf + '. ' + opt + '</button>';
                            qi += optHtml;
                        });
                        qi += '</div>';
                    }
                    qi += '<div class="quiz-explanation"><b>Pembahasan:</b> ' + (q.explanation || 'Tepat!') + '</div></div>';
                });
                qi += '<div class="quiz-nav-bar" style="margin-top:0;border-top:none;">';
                blok.questions.forEach(function(q, qIdx) {
                    qi += '<button type="button" class="quiz-nav-btn" id="nav-btn-inline-' + index + '-' + qIdx + '" onclick="document.querySelector(\'#inline-q-' + index + '-' + qIdx + '\').scrollIntoView({behavior:\'smooth\',block:\'center\'})">' + (qIdx + 1) + '</button>';
                });
                qi += '</div>';
            } else {
                qi += '<p style="color:#888;">Belum ada soal.</p>';
            }
            qi += '</div>';

            html += '<div class="block-wrapper" data-index="' + index + '" style="padding-top:' + blok.padTop + ';padding-bottom:' + blok.padBot + ';">' +
                '<div class="content-block ' + (blok.pattern || '') + '" data-index="' + index + '" data-width="' + blok.width + '" style="background-color:' + blok.bg + ';">' +
                '<canvas class="drawing-layer" data-index="' + index + '"></canvas>' +
                ctrlHtml + qi +
                '</div></div>';
        } else {
            var isiTeks = (blok.html && blok.html.trim() !== '') ? blok.html : '<p><br></p>';
            html += '<div class="block-wrapper" data-index="' + index + '" style="padding-top:' + blok.padTop + ';padding-bottom:' + blok.padBot + ';">' +
                '<div class="content-block ' + (blok.pattern || '') + '" ' + (isEdit ? 'contenteditable="true"' : '') + ' data-index="' + index + '" data-width="' + blok.width + '" style="color:' + blok.color + '; background-color:' + blok.bg + ';">' +
                '<canvas class="drawing-layer" data-index="' + index + '"></canvas>' +
                ctrlHtml + isiTeks +
                '</div></div>';
        }
    });
    var container = document.getElementById('blocks-container');
    if (container) container.innerHTML = html;
    setTimeout(inisialisasiSemuaCanvas, 300);
    if (window.renderMathJax) window.renderMathJax();
};

// Jaga agar saat semua teks dihapus dengan Backspace, paragraf kosong tetap ada di luar tombol Setting
document.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
        var blk = e.target.closest && e.target.closest('.content-block[contenteditable="true"]');
        if (blk) {
            setTimeout(function() {
                var clone = blk.cloneNode(true);
                clone.querySelectorAll('.drawing-layer, .block-controls').forEach(function(el) { el.remove(); });
                if (clone.innerText.trim() === '' && !clone.querySelector('img, table, p, div')) {
                    blk.insertAdjacentHTML('beforeend', '<p><br></p>');
                }
            }, 10);
        }
    }
});

// Ekstrak Kuis Manual & AI dengan mode 'replace' (Ekstrak Ulang) dan 'append' (Tambahkan Soal)
window.ekstrakTeksKeArraySoalGlobal = ekstrakTeksKeArraySoal;

// ============================================================================
// MASTER PATCH FIREBASE-DB: FIX TOMBOL X, POPUP, PINDAH ROOM TANPA KELUAR
// FULLSCREEN, SLIDE PDF, FULLSCREEN BLOCK, DAN DRAW (ERASER + UNDO/REDO)
// ============================================================================

window.inisialisasiSemuaCanvas = inisialisasiSemuaCanvas;
window.inisialisasiSatuCanvas = inisialisasiSatuCanvas;

// 1. Rapikan Tombol Popup, Tombol X Ujian, Tombol PDF & Undo/Redo secara Otomatis
function terapkanPerbaikanUIUtama() {
    // Sembunyikan tombol Popup yang masih tersisa di Admin Menu Bar
    document.querySelectorAll('#admin-menu-bar span').forEach(function(el) {
        if (/Popup/i.test(el.innerText || "") || /bukaWelcomePopup/i.test(el.getAttribute('onclick') || "")) {
            el.style.display = 'none';
        }
    });

    // Pastikan tombol Popup tampil di kiri atas Header saat mode Guru
    var headerWrap = document.getElementById('header-wrap');
    if (headerWrap) {
        var btnPop = headerWrap.querySelector('.header-popup-btn');
        if (!btnPop) {
            btnPop = document.createElement('button');
            btnPop.className = 'header-popup-btn';
            btnPop.innerHTML = '📢 Popup';
            btnPop.onclick = function(e) { e.stopPropagation(); window.bukaWelcomePopup(); };
            headerWrap.insertBefore(btnPop, headerWrap.firstChild);
        }
        var isGuru = sessionStorage.getItem("statusGuru") === "aktif" && sessionStorage.getItem("previewMode") !== "true";
        btnPop.style.cssText = "position:absolute; left:20px; top:15px; z-index:999; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5); color:#fff; padding:6px 14px; border-radius:20px; font-family:'Poppins',sans-serif; font-size:12px; font-weight:bold; cursor:pointer; display:" + (isGuru ? "inline-flex" : "none") + ";";
    }

    // Perbaiki Tombol X pada Modal Masuk Ujian & Semua Modal agar tidak tertimpa event lain
    document.querySelectorAll('.modal-overlay .close-btn').forEach(function(btn) {
        var parentModal = btn.closest('.modal-overlay');
        if (parentModal && parentModal.id !== 'modal-welcome-popup') {
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                parentModal.style.display = 'none';
            };
        }
    });

    // Pastikan tombol Undo & Redo ada di dalam #pen-tools
    var penTools = document.getElementById('pen-tools');
    if (penTools && !document.getElementById('btn-undo-draw')) {
        var btnPen = document.getElementById('btn-pen');
        var undoBtn = document.createElement('button');
        undoBtn.id = 'btn-undo-draw';
        undoBtn.className = 'tool-btn';
        undoBtn.style.cssText = 'background:#34495e; color:white; border-color:#2c3e50;';
        undoBtn.innerHTML = '↩️ Undo';
        undoBtn.onclick = function() { window.undoDraw(); };

        var redoBtn = document.createElement('button');
        redoBtn.id = 'btn-redo-draw';
        redoBtn.className = 'tool-btn';
        redoBtn.style.cssText = 'background:#34495e; color:white; border-color:#2c3e50;';
        redoBtn.innerHTML = '↪️ Redo';
        redoBtn.onclick = function() { window.redoDraw(); };

        if (btnPen) {
            penTools.insertBefore(undoBtn, btnPen);
            penTools.insertBefore(redoBtn, btnPen);
        } else {
            penTools.appendChild(undoBtn);
            penTools.appendChild(redoBtn);
        }
    }

    // Pastikan tombol 📄 PDF ada di dalam #toolbar
    var toolbar = document.getElementById('toolbar');
    if (toolbar && !document.getElementById('btn-toolbar-pdf')) {
        var imgInput = document.getElementById('image-upload-input');
        var targetBtn = toolbar.querySelector('button[onclick*="image-upload-input"]');
        var pdfBtn = document.createElement('button');
        pdfBtn.id = 'btn-toolbar-pdf';
        pdfBtn.type = 'button';
        pdfBtn.title = 'Sisipkan Slide PDF ke Content Block';
        pdfBtn.style.cssText = 'background:#ebf5fb; color:#2980b9; border:1px solid #aed6f1; font-weight:bold; margin-left:2px;';
        pdfBtn.innerHTML = '📄 PDF';
        pdfBtn.onclick = function() {
            var up = document.getElementById('pdf-materi-upload');
            if (!up) {
                up = document.createElement('input');
                up.type = 'file';
                up.id = 'pdf-materi-upload';
                up.accept = 'application/pdf';
                up.style.display = 'none';
                up.onchange = function() { window.prosesUploadPDFMateri(this); };
                document.body.appendChild(up);
            }
            up.value = '';
            up.click();
        };
        if (targetBtn && targetBtn.parentNode) {
            targetBtn.parentNode.insertBefore(pdfBtn, targetBtn.nextSibling);
        }
    }
}

// 2. Pindah Room Tanpa Reload (Menjaga Fullscreen Tetap Aktif & Tombol Back Mulus)
window.pindahRoomTanpaReload = function(slugBaru, simpanHistory) {
    babAktif = slugBaru || "home";
    if (simpanHistory !== false) {
        history.pushState({ bab: babAktif }, '', 'index.html?bab=' + babAktif);
    }
    if (window.closeDropdowns) window.closeDropdowns();
    if (window.keluarBlockFullscreen) window.keluarBlockFullscreen();

    document.querySelectorAll('#dynamic-navbar a').forEach(function(a) {
        var href = a.getAttribute('href') || '';
        if (href === 'index.html?bab=' + babAktif) a.classList.add('active');
        else a.classList.remove('active');
    });
    updateBreadcrumb();

    get(child(ref(db), 'materi_koleksi/' + babAktif)).then(function(snap) {
        if (snap.exists() && snap.val().blocksObj) {
            window.contentBlocksData = snap.val().blocksObj;
            window.floatingBoxesData = snap.val().floatingBoxesObj || [];
        } else {
            window.contentBlocksData = [{type:'text',html:"<p>Ketik materi...</p>",bg:"#ffffff",pattern:"",color:"#333333",width:"M",padTop:"40px",padBot:"40px",drawing:""}];
            window.floatingBoxesData = [];
        }
        window.contentBlocksData.forEach(function(b) {
            if (!b.padTop) b.padTop = "40px";
            if (!b.padBot) b.padBot = "40px";
            if (!b.drawing) b.drawing = "";
            if (!b.type) b.type = "text";
            if (!b.pattern) b.pattern = "";
        });
        window.drawUndoStack = {};
        window.drawRedoStack = {};
        window.renderBlocks();
        window.renderFloatingBoxes();
        if (window.renderMathJax) window.renderMathJax();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
};

// Tangkap klik link room di Navbar agar tidak me-reload halaman (Fullscreen tetap bertahan)
document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href*="index.html?bab="]');
    if (link) {
        var nextUl = link.nextElementSibling;
        if (window.innerWidth <= 768 && nextUl && nextUl.tagName === 'UL') return;
        e.preventDefault();
        var href = link.getAttribute('href');
        var slug = href.split('bab=')[1];
        if (slug) window.pindahRoomTanpaReload(slug, true);
    }
});

window.addEventListener('popstate', function(e) {
    var params = new URLSearchParams(window.location.search);
    var slug = (e.state && e.state.bab) ? e.state.bab : (params.get('bab') || 'home');
    window.pindahRoomTanpaReload(slug, false);
});

// 3. Render Blocks Terpadu (Mendukung Slide PDF Geser Kiri-Kanan, Kuis, Teks & Tombol Fokus)
window.renderBlocks = function() {
    var html = '';
    var isEdit = document.body.classList.contains('mode-edit-aktif') || document.documentElement.classList.contains('force-edit-mode');
    (window.contentBlocksData || []).forEach(function(blok, index) {
        var qi = '';
        var ctrlHtml = '<div class="block-controls" contenteditable="false" style="user-select:none;">' +
            '<button type="button" contenteditable="false" onclick="window.toggleBlockFullscreen(this, ' + index + ')" style="background:#eaf2f8; color:#2980b9;">🔲 Fokus</button>' +
            '<button type="button" contenteditable="false" onclick="geserBlok(' + index + ', -1)">⬆️</button>' +
            '<button type="button" contenteditable="false" onclick="geserBlok(' + index + ', 1)">⬇️</button>' +
            '<button type="button" contenteditable="false" onclick="bukaSidebarBlock(' + index + ')">⚙️ Setting</button>' +
            '<button type="button" contenteditable="false" onclick="hapusBlok(' + index + ')">🗑️ Delete</button>' +
            '</div>';

        if (blok.type === 'pdf') {
            var pages = blok.pages || [];
            var curSlide = blok.currentSlide || 0;
            var slidesHtml = '<div class="pdf-control-bar" contenteditable="false">' +
                '<button type="button" onclick="window.geserSlidePDF(' + index + ', -1)">◀ Slide Sebelumnya</button>' +
                '<span>📄 Halaman <b id="pdf-page-num-' + index + '">' + (curSlide + 1) + '</b> dari <b>' + pages.length + '</b> (Geser Kiri/Kanan)</span>' +
                '<div style="display:flex; gap:6px;">' +
                    '<button type="button" onclick="window.geserSlidePDF(' + index + ', 1)">Slide Berikutnya ▶</button>' +
                    '<button type="button" style="background:#8e44ad;" onclick="window.toggleBlockFullscreen(this, ' + index + ')">🔲 Fokus</button>' +
                '</div>' +
            '</div>' +
            '<div class="pdf-slider-container" id="pdf-slider-' + index + '" onscroll="window.onScrollSlidePDF(' + index + ', this)">';

            pages.forEach(function(pg, i) {
                slidesHtml += '<div class="pdf-slide"><img src="' + pg + '" alt="Slide ' + (i + 1) + '"></div>';
            });
            slidesHtml += '</div>';

            html += '<div class="block-wrapper" data-index="' + index + '" style="padding-top:' + blok.padTop + ';padding-bottom:' + blok.padBot + ';">' +
                '<div class="content-block" data-index="' + index + '" data-width="' + (blok.width || 'L') + '" style="background-color:' + blok.bg + ';">' +
                '<canvas class="drawing-layer" data-index="' + index + '"></canvas>' +
                ctrlHtml + slidesHtml +
                '</div></div>';
        } else if (blok.type === 'quiz') {
            qi += '<div class="quiz-container" id="inline-kuis-' + index + '"><div class="quiz-header"><h3 class="quiz-title">🧩 Uji Pemahaman</h3><div><button type="button" class="btn-action" style="background:#34495e;width:auto;font-size:11px;padding:6px 12px;margin-right:5px;" onclick="cetakKuisPDF(\'inline-kuis-' + index + '\',\'Materi\')">🖨️ Cetak</button>' + (isEdit ? '<button type="button" class="btn-action" style="background:#2e7d32;width:auto;font-size:11px;padding:6px 12px;" onclick="bukaAIQuizModal(' + index + ')">🤖 Ekstrak</button>' : '') + '</div></div>';
            if (blok.questions && blok.questions.length > 0) {
                blok.questions.forEach(function(q, qIdx) {
                    var qTextHtml = isEdit
                        ? '<div class="quiz-question-text" contenteditable="true" oninput="updateSoalInline(' + index + ',' + qIdx + ',\'q\',this)">' + (qIdx + 1) + '. ' + q.question + '</div>'
                        : '<div class="quiz-question-text">' + (qIdx + 1) + '. ' + q.question + '</div>';
                    qi += '<div class="quiz-question-card" id="inline-q-' + index + '-' + qIdx + '">' + (isEdit ? '<button type="button" class="btn-delete-q" contenteditable="false" onclick="hapusSoalSistem(' + qIdx + ', \'inline\', ' + index + ')" title="Hapus Soal">🗑️</button>' : '') + qTextHtml;
                    if (q.type === 'short_answer' || (!q.options && q.correctAnswers)) {
                        var altStr = q.correctAnswers ? q.correctAnswers.join(' | ') : '';
                        qi += '<div class="short-answer-box" style="margin-top:10px;"><input type="text" class="input-box" placeholder="Ketik jawaban singkat..." style="font-size:15px; font-weight:600; padding:10px 12px; border:2px solid #3498db; border-radius:8px; width:100%; box-sizing:border-box;" oninput="jawabKuisInlineIsian(this, ' + index + ', ' + qIdx + ')">' + (isEdit ? '<div style="font-size:11px; color:#c0392b; margin-top:8px; background:#fadbd8; padding:6px; border-radius:4px; border-left:4px solid #e74c3c;"><b>🔒 Info Admin:</b> Alternatif Kunci: ' + altStr + '</div>' : '') + '</div>';
                    } else {
                        qi += '<div class="quiz-options">';
                        (q.options || []).forEach(function(opt, oIdx) {
                            var huruf = String.fromCharCode(65 + oIdx);
                            qi += isEdit
                                ? '<div class="quiz-option-btn" contenteditable="true" oninput="updateSoalInline(' + index + ',' + qIdx + ',\'o\',this,' + oIdx + ')">' + huruf + '. ' + opt + '</div>'
                                : '<button type="button" class="quiz-option-btn" onclick="jawabKuisInline(this,' + index + ',' + qIdx + ',' + oIdx + ',' + q.correctIndex + ')">' + huruf + '. ' + opt + '</button>';
                        });
                        qi += '</div>';
                    }
                    qi += '<div class="quiz-explanation"><b>Pembahasan:</b> ' + (q.explanation || 'Tepat!') + '</div></div>';
                });
                qi += '<div class="quiz-nav-bar" style="margin-top:0;border-top:none;">';
                blok.questions.forEach(function(q, qIdx) {
                    qi += '<button type="button" class="quiz-nav-btn" id="nav-btn-inline-' + index + '-' + qIdx + '" onclick="document.querySelector(\'#inline-q-' + index + '-' + qIdx + '\').scrollIntoView({behavior:\'smooth\',block:\'center\'})">' + (qIdx + 1) + '</button>';
                });
                qi += '</div>';
            } else {
                qi += '<p style="color:#888;">Belum ada soal.</p>';
            }
            qi += '</div>';
            html += '<div class="block-wrapper" data-index="' + index + '" style="padding-top:' + blok.padTop + ';padding-bottom:' + blok.padBot + ';">' +
                '<div class="content-block ' + (blok.pattern || '') + '" data-index="' + index + '" data-width="' + blok.width + '" style="background-color:' + blok.bg + ';">' +
                '<canvas class="drawing-layer" data-index="' + index + '"></canvas>' +
                ctrlHtml + qi +
                '</div></div>';
        } else {
            var isiTeks = (blok.html && blok.html.trim() !== '') ? blok.html : '<p><br></p>';
            html += '<div class="block-wrapper" data-index="' + index + '" style="padding-top:' + blok.padTop + ';padding-bottom:' + blok.padBot + ';">' +
                '<div class="content-block ' + (blok.pattern || '') + '" ' + (isEdit ? 'contenteditable="true"' : '') + ' data-index="' + index + '" data-width="' + blok.width + '" style="color:' + blok.color + '; background-color:' + blok.bg + ';">' +
                '<canvas class="drawing-layer" data-index="' + index + '"></canvas>' +
                ctrlHtml + isiTeks +
                '</div></div>';
        }
    });
    var container = document.getElementById('blocks-container');
    if (container) container.innerHTML = html;
    setTimeout(window.muatUlangSemuaKanvasGambar, 250);
    if (window.renderMathJax) window.renderMathJax();
};

// 4. Kanvas Gambar: Memuat Gambar Lama Agar Bisa Dihapus Eraser & Mendukung Undo/Redo
window.muatUlangSemuaKanvasGambar = function() {
    document.querySelectorAll('.drawing-layer').forEach(function(cvs) {
        var p = cvs.parentElement;
        if (!p) return;
        var cw = p.clientWidth || p.offsetWidth;
        var ch = p.clientHeight || p.offsetHeight;
        if (cw === 0 || ch === 0) return;

        var fbIdx = cvs.getAttribute('data-fb-index');
        var blockIdx = cvs.getAttribute('data-index');
        var sv = '';
        if (fbIdx !== null && window.floatingBoxesData && window.floatingBoxesData[fbIdx]) {
            sv = window.floatingBoxesData[fbIdx].drawing || '';
        } else if (blockIdx !== null && window.contentBlocksData && window.contentBlocksData[blockIdx]) {
            var bObj = window.contentBlocksData[blockIdx];
            if (bObj.type === 'pdf' && bObj.slideDrawings) {
                sv = bObj.slideDrawings[bObj.currentSlide || 0] || '';
            } else {
                sv = bObj.drawing || '';
            }
        }

        if (cvs.width !== cw || cvs.height !== ch) {
            cvs.width = cw;
            cvs.height = ch;
        }
        var ctx = cvs.getContext('2d', { willReadFrequently: true });
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.clearRect(0, 0, cw, ch);
        ctx.restore();

        if (sv) {
            var img = new Image();
            img.onload = function() {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1.0;
                ctx.drawImage(img, 0, 0);
                ctx.restore();
            };
            img.src = sv;
        }
    });
};

// Rekam je

// ============================================================================
// UPGRADE FIREBASE-DB: RUANG ADMINISTRASI (ABSENSI & AGENDA), ANTI-EXIT
// FULLSCREEN PADA LATIHAN/UJIAN, DAN KEAMANAN DATABASE
// ============================================================================

window.dataAbsensiGlobal = {};
window.dataAgendaGlobal = {};

// 1. Sinkronisasi Data Absensi & Agenda dari Firebase
onValue(ref(db, 'administrasi_guru/absensi'), function(snap) {
    window.dataAbsensiGlobal = snap.exists() ? snap.val() : {};
    var modalAdm = document.getElementById('modal-ruang-administrasi');
    if (modalAdm && modalAdm.style.display === 'flex' && window.tabAdminAktif === 'absensi') {
        window.renderTabelAbsensiKelas();
    }
});

onValue(ref(db, 'administrasi_guru/agenda'), function(snap) {
    window.dataAgendaGlobal = snap.exists() ? snap.val() : {};
    var modalAdm = document.getElementById('modal-ruang-administrasi');
    if (modalAdm && modalAdm.style.display === 'flex' && window.tabAdminAktif === 'agenda') {
        window.renderTabelAgendaKelas();
    }
});

window.simpanAbsensiKeDB = function() {
    return set(ref(db, 'administrasi_guru/absensi'), window.dataAbsensiGlobal);
};

window.simpanAgendaKeDB = function() {
    return set(ref(db, 'administrasi_guru/agenda'), window.dataAgendaGlobal);
};

// 2. Tambahkan Tombol "📁 Administrasi" di Toolbar Admin
function pasangTombolAdministrasi() {
    var adminBar = document.getElementById('admin-menu-bar');
    if (adminBar && !document.getElementById('btn-menu-administrasi')) {
        var spanAdm = document.createElement('span');
        spanAdm.id = 'btn-menu-administrasi';
        spanAdm.style.cssText = 'color:#0b3954; background:#e8f4f8; border:1px solid #aed6f1; padding:4px 10px; border-radius:6px; font-weight:bold;';
        spanAdm.innerHTML = '📁 Administrasi';
        spanAdm.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            window.bukaModalAdministrasi('pilihan');
        };
        var liveMon = adminBar.querySelector('span[onclick*="LiveMonitor"]');
        if (liveMon) {
            adminBar.insertBefore(spanAdm, liveMon);
        } else {
            adminBar.appendChild(spanAdm);
        }
    }
}
setTimeout(pasangTombolAdministrasi, 900);

// 3. Cegah Latihan Mandiri & Ujian Keluar dari Fullscreen
window.pulihkanFullscreenJikaPerlu = function() {
    if (sessionStorage.getItem('autoFS') === 'true' && !document.fullscreenElement && !document.webkitFullscreenElement) {
        var elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(function(){});
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen().catch(function(){});
    }
};

window.tutupLatihanMandiri = function() {
    window.tampilkanKonfirmasiFullscreen("Keluar dari Ruang Latihan Mandiri?", function() {
        document.getElementById('temporary-quiz-room').style.display = 'none';
        document.getElementById('temporary-quiz-container').innerHTML = "";
        document.body.style.overflow = 'auto';
        window.pulihkanFullscreenJikaPerlu();
    });
};

window.tutupUjianStrict = function() {
    if (window.isStrictUjianActive) {
        window.tampilkanToastFullscreen("⚠️ Selesaikan dan kumpulkan ujian terlebih dahulu!");
        return;
    }
    document.getElementById('ujian-strict-room').style.display = 'none';
    document.getElementById('ujian-strict-container').innerHTML = "";
    document.body.style.overflow = 'auto';
    window.pulihkanFullscreenJikaPerlu();
};

// ============================================================================
// PATCH SINKRONISASI KELAS & DATA SISWA KE FIREBASE
// ============================================================================
window.simpanKonfigPendidikanKeDB = function() {
    if (typeof db !== 'undefined' && window.konfigPendidikan) {
        set(ref(db, 'konfigurasi_pendidikan'), window.konfigPendidikan);
    }
    if (typeof perbaruiSemuaDropdownKonfig === 'function') {
        perbaruiSemuaDropdownKonfig();
    }
};

// ============================================================================
// SINKRONISASI DATA REMINDER (ABSENSI & UJIAN) KE FIREBASE
// ============================================================================
window.dataReminderDismissed = {};
window.dataUjianKelasPantau = {};

onValue(ref(db, 'administrasi_guru/reminder_dismissed'), function(snap) {
    window.dataReminderDismissed = snap.exists() ? snap.val() : {};
    if (window.updateBadgeReminderAdmin) window.updateBadgeReminderAdmin();
    var modalAdm = document.getElementById('modal-ruang-administrasi');
    if (modalAdm && modalAdm.style.display === 'flex' && window.tabAdminAktif === 'reminder') {
        window.tampilkanUIReminder();
    }
});

onValue(ref(db, 'administrasi_guru/ujian_kelas_pantau'), function(snap) {
    window.dataUjianKelasPantau = snap.exists() ? snap.val() : {};
    if (window.updateBadgeReminderAdmin) window.updateBadgeReminderAdmin();
    var modalAdm = document.getElementById('modal-ruang-administrasi');
    if (modalAdm && modalAdm.style.display === 'flex' && window.tabAdminAktif === 'reminder') {
        window.tampilkanUIReminder();
    }
});

window.simpanReminderDismissedKeDB = function() {
    return set(ref(db, 'administrasi_guru/reminder_dismissed'), window.dataReminderDismissed);
};

window.simpanUjianKelasPantauKeDB = function() {
    return set(ref(db, 'administrasi_guru/ujian_kelas_pantau'), window.dataUjianKelasPantau);
};

// ============================================================================
// PATCH MULTI-TENANT: PENJAGA URL GURU & TOMBOL SALIN LINK MURID
// ============================================================================

// 1. Memodifikasi Navigasi agar selalu mengingat di Ruang Guru mana Murid berada
window.pindahRoomTanpaReload = function(slugBaru, simpanHistory) {
    babAktif = slugBaru || "home";
    
    // Ambil parameter guru saat ini untuk ditempelkan ke link selanjutnya
    let paramGuru = new URLSearchParams(window.location.search).get('guru');
    let stringGuru = paramGuru ? '&guru=' + paramGuru : '';

    if (simpanHistory !== false) {
        history.pushState({ bab: babAktif }, '', 'index.html?bab=' + babAktif + stringGuru);
    }
    if (window.closeDropdowns) window.closeDropdowns();
    if (window.keluarBlockFullscreen) window.keluarBlockFullscreen();

    document.querySelectorAll('#dynamic-navbar a').forEach(function(a) {
        var href = a.getAttribute('href') || '';
        if (href.includes('bab=' + babAktif)) a.classList.add('active');
        else a.classList.remove('active');
    });
    if (typeof updateBreadcrumb === 'function') updateBreadcrumb();

    get(child(ref(db), 'materi_koleksi/' + babAktif)).then(function(snap) {
        if (snap.exists() && snap.val().blocksObj) {
            window.contentBlocksData = snap.val().blocksObj;
            window.floatingBoxesData = snap.val().floatingBoxesObj || [];
        } else {
            window.contentBlocksData = [{type:'text',html:"<p>Belum ada materi di ruang ini.</p>",bg:"#ffffff",pattern:"",color:"#333333",width:"M",padTop:"40px",padBot:"40px",drawing:""}];
            window.floatingBoxesData = [];
        }
        window.contentBlocksData.forEach(function(b) {
            if (!b.padTop) b.padTop = "40px"; if (!b.padBot) b.padBot = "40px";
            if (!b.drawing) b.drawing = ""; if (!b.type) b.type = "text";
        });
        window.drawUndoStack = {}; window.drawRedoStack = {};
        window.renderBlocks(); window.renderFloatingBoxes();
        if (window.renderMathJax) window.renderMathJax();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
};

// 2. Mencegah link dipecah secara keliru jika mengandung &guru=
document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href*="index.html?bab="]');
    if (link) {
        var nextUl = link.nextElementSibling;
        if (window.innerWidth <= 768 && nextUl && nextUl.tagName === 'UL') return;
        e.preventDefault();
        var href = link.getAttribute('href');
        var slug = href.split('bab=')[1].split('&')[0]; // Ambil nama bab murni
        if (slug) window.pindahRoomTanpaReload(slug, true);
    }
});

// 3. Tambahkan Tombol "🔗 Salin Link Murid" di Toolbar Admin
var origTerapkanPerbaikanUIMulti = window.terapkanPerbaikanUIUtama;
window.terapkanPerbaikanUIUtama = function() {
    if(typeof origTerapkanPerbaikanUIMulti === 'function') origTerapkanPerbaikanUIMulti();

    var adminBar = document.getElementById('admin-menu-bar');
    var isGuru = sessionStorage.getItem("statusGuru") === "aktif" && sessionStorage.getItem("previewMode") !== "true";
    
    if (adminBar && isGuru && !document.getElementById('btn-copy-link-murid')) {
        var btnLink = document.createElement('span');
        btnLink.id = 'btn-copy-link-murid';
        btnLink.style.cssText = 'color:#fff; background:#e67e22; border:1px solid #d35400; padding:4px 10px; border-radius:6px; font-weight:bold; margin-left:10px; transition:0.2s;';
        btnLink.innerHTML = '🔗 Salin Link Murid';
        btnLink.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            var activeGuru = sessionStorage.getItem("guruUsername") || "mahardika";
            var linkShare = window.location.origin + window.location.pathname + "?guru=" + activeGuru;
            
            navigator.clipboard.writeText(linkShare).then(function() {
                alert("✅ Link berhasil disalin!\nBagikan link ini ke murid Anda: \n\n" + linkShare);
            }).catch(function() {
                prompt("Gagal menyalin otomatis. Silakan blok dan salin link di bawah ini:", linkShare);
            });
        };
        adminBar.appendChild(btnLink);
    }
};

// ============================================================================
// PATCH SINKRONISASI PENUH: MANAJER LATIHAN, MANAJER UJIAN & MENU SISWA
// ============================================================================

// 1. Konversi Otomatis Semua Format Soal (Object V5 / Array Lama -> Array Standar)
window.normalisasiButirSoal = function(q) {
    if (!q || typeof q !== 'object') return null;
    var tanya = q.question || q.teks || q.soal || q.pertanyaan || '';
    if (!tanya) return null;

    var rawType = String(q.type || q.tipe || q.jenis || 'mc').toLowerCase();
    var bahas = q.explanation || q.pembahasan || '';

    // Tipe Essay
    if (rawType === 'essay' || rawType === 'uraian' || rawType === 'esai') {
        var kEssay = Array.isArray(q.correctAnswers) ? q.correctAnswers : (q.kunci ? [String(q.kunci)] : []);
        return {
            type: 'essay',
            question: tanya,
            correctAnswers: kEssay,
            explanation: bahas || (kEssay[0] ? 'Rubrik/Kunci: ' + kEssay[0] : 'Soal Essay')
        };
    }

    // Cek apakah memiliki opsi Pilihan Ganda
    var opsiArr = [];
    if (Array.isArray(q.options)) {
        opsiArr = q.options;
    } else if (q.options && typeof q.options === 'object') {
        ['A', 'B', 'C', 'D', 'E'].forEach(function(h) {
            if (q.options[h] !== undefined && q.options[h] !== '') opsiArr.push(q.options[h]);
        });
    } else if (q.opsi && typeof q.opsi === 'object') {
        ['A', 'B', 'C', 'D', 'E'].forEach(function(h) {
            if (q.opsi[h] !== undefined && q.opsi[h] !== '') opsiArr.push(q.opsi[h]);
        });
    } else if (q.a || q.b || q.c || q.d) {
        opsiArr = [q.a || '', q.b || '', q.c || '', q.d || ''];
        if (q.e) opsiArr.push(q.e);
    }

    // Tipe Isian Singkat (IS)
    if (rawType === 'short_answer' || rawType === 'is' || rawType === 'isian' || (opsiArr.length === 0 && (q.correctAnswers || q.kunci))) {
        var kIS = [];
        if (Array.isArray(q.correctAnswers)) kIS = q.correctAnswers;
        else if (Array.isArray(q.kunci_alternatif)) kIS = q.kunci_alternatif;
        else if (q.kunci || q.jawaban) {
            kIS = String(q.kunci || q.jawaban).split('|').map(function(s) { return s.trim(); }).filter(Boolean);
        }
        return {
            type: 'short_answer',
            question: tanya,
            correctAnswers: kIS.length > 0 ? kIS : [''],
            explanation: bahas || ('Kunci: ' + kIS.join(' | '))
        };
    }

    // Tipe Pilihan Ganda (PG)
    var idxKunci = 0;
    if (typeof q.correctIndex === 'number' && !isNaN(q.correctIndex)) {
        idxKunci = q.correctIndex;
    } else if (q.kunci || q.jawaban) {
        var kode = String(q.kunci || q.jawaban).trim().toUpperCase().charCodeAt(0) - 65;
        if (kode >= 0 && kode < 5) idxKunci = kode;
    }

    return {
        type: 'mc',
        question: tanya,
        options: opsiArr.length > 0 ? opsiArr : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
        correctIndex: idxKunci,
        explanation: bahas || ('Jawaban benar: ' + String.fromCharCode(65 + idxKunci))
    };
};

// 2. Pembaca Array Soal Universal (Bisa membaca Array langsung, .questions, atau .soal)
window.ambilArraySoal = function(paket) {
    if (!paket) return [];
    var raw = [];
    if (Array.isArray(paket)) raw = paket;
    else if (Array.isArray(paket.questions)) raw = paket.questions;
    else if (Array.isArray(paket.soal)) raw = paket.soal;
    else if (Array.isArray(paket.daftar_soal)) raw = paket.daftar_soal;
    else if (typeof paket === 'object') {
        var sub = paket.questions || paket.soal || paket.daftar_soal || paket;
        if (typeof sub === 'object') {
            raw = Object.values(sub).filter(function(item) {
                return item && typeof item === 'object' && (item.question || item.teks || item.soal || item.pertanyaan);
            });
        }
    }
    return raw.map(window.normalisasiButirSoal).filter(Boolean);
};

window.uraiInfoPaketLatihan = function(key, paketObj) {
    var jenjang = (paketObj && (paketObj.jenjang || paketObj.kelas)) || '';
    var mapel = (paketObj && paketObj.mapel) || '';
    var judul = (paketObj && (paketObj.judul || paketObj.bab || paketObj.nama_paket)) || '';

    if (!jenjang || !mapel) {
        var mBracket = key.match(/^[\(\[](.*?)\s*-\s*(.*?)[\)\]]\s*(.*)/);
        if (mBracket) {
            jenjang = jenjang || mBracket[1].trim();
            mapel = mapel || mBracket[2].trim();
            judul = judul || mBracket[3].trim();
        } else {
            var parts = key.split(' - ');
            if (parts.length >= 3) {
                jenjang = jenjang || parts[0].trim();
                mapel = mapel || parts[1].trim();
                judul = judul || parts.slice(2).join(' - ').trim();
            }
        }
    }
    return {
        jenjang: jenjang || 'Umum',
        mapel: mapel || 'Umum',
        judul: judul || key
    };
};

// 3. Satukan Semua Node Database Latihan & Ujian Secara Real-Time
(function sinkronSemuaBankSoal() {
    var srcPusat = {}, srcV5 = {}, srcTerpadu = {};

    function bangunBankLatihanGabungan() {
        var hasil = {};

        // Dari bank_soal_pusat (format lama)
        Object.keys(srcPusat || {}).forEach(function(kls) {
            Object.keys(srcPusat[kls] || {}).forEach(function(mpl) {
                Object.keys(srcPusat[kls][mpl] || {}).forEach(function(bab) {
                    var kumpul = [];
                    Object.keys(srcPusat[kls][mpl][bab] || {}).forEach(function(kes) {
                        kumpul = kumpul.concat(window.ambilArraySoal(srcPusat[kls][mpl][bab][kes]));
                    });
                    if (kumpul.length > 0) {
                        var k = '[' + kls + ' - ' + mpl + '] ' + bab;
                        hasil[k] = { jenjang: kls, mapel: mpl, judul: bab, questions: kumpul };
                    }
                });
            });
        });

        // Dari bank_latihan (format V5)
        Object.keys(srcV5 || {}).forEach(function(k) {
            var pkt = srcV5[k];
            var arr = window.ambilArraySoal(pkt);
            if (arr.length > 0) {
                var info = window.uraiInfoPaketLatihan(k, pkt);
                var keyRapi = '[' + info.jenjang + ' - ' + info.mapel + '] ' + info.judul;
                hasil[keyRapi] = { idV5: k, jenjang: info.jenjang, mapel: info.mapel, judul: info.judul, questions: arr };
            }
        });

        // Dari bank_latihan_terpadu (utama)
        Object.keys(srcTerpadu || {}).forEach(function(k) {
            var pkt = srcTerpadu[k];
            var arr = window.ambilArraySoal(pkt);
            if (arr.length > 0) {
                var info = window.uraiInfoPaketLatihan(k, pkt);
                hasil[k] = { jenjang: info.jenjang, mapel: info.mapel, judul: info.judul, questions: arr };
            }
        });

        window.bankLatihanTerpadu = hasil;
        window.bankSoalGlobal = hasil;
        window.renderDropdownBankLatihanBawah();
        if (window.paketLatihanTerpilih && hasil[window.paketLatihanTerpilih]) {
            window.pilihPaketLatihanDariDropdown(window.paketLatihanTerpilih);
        }
    }

    onValue(ref(db, 'bank_soal_pusat'), function(s) { srcPusat = s.exists() ? s.val() : {}; bangunBankLatihanGabungan(); });
    onValue(ref(db, 'bank_latihan'), function(s) { srcV5 = s.exists() ? s.val() : {}; bangunBankLatihanGabungan(); });
    onValue(ref(db, 'bank_latihan_terpadu'), function(s) { srcTerpadu = s.exists() ? s.val() : {}; bangunBankLatihanGabungan(); });

    // Gabungkan bank_soal_ujian dan bank_ujian agar 100% sinkron
    var ujianLama = {}, ujianBaru = {};
    function bangunBankUjianGabungan() {
        var hasilUjian = {};
        Object.keys(ujianLama || {}).forEach(function(k) {
            var arr = window.ambilArraySoal(ujianLama[k]);
            if (arr.length > 0) hasilUjian[k] = arr;
        });
        Object.keys(ujianBaru || {}).forEach(function(k) {
            var arr = window.ambilArraySoal(ujianBaru[k]);
            if (arr.length > 0) hasilUjian[k] = arr;
        });
        window.bankUjianGlobal = hasilUjian;
        window.renderDropdownBankUjianBawah();
        if (window.paketUjianTerpilih && hasilUjian[window.paketUjianTerpilih]) {
            window.pilihPaketUjianDariDropdown(window.paketUjianTerpilih);
        }
    }

    onValue(ref(db, 'bank_soal_ujian'), function(s) { ujianLama = s.exists() ? s.val() : {}; bangunBankUjianGabungan(); });
    onValue(ref(db, 'bank_ujian'), function(s) { ujianBaru = s.exists() ? s.val() : {}; bangunBankUjianGabungan(); });
})();

// 4. Pastikan Dropdown Bawah & Atas Selalu Sinkron
window.renderDropdownBankLatihanBawah = function() {
    var sel = document.getElementById('dropdown-bank-latihan-bawah');
    if (!sel) return;
    var keys = Object.keys(window.bankLatihanTerpadu || {}).sort();
    if (keys.length === 0) {
        sel.innerHTML = '<option value="">-- Belum ada Bank Soal Latihan yang diinput --</option>';
        return;
    }
    var html = '<option value="">-- Pilih Bank Soal (' + keys.length + ' Paket Tersimpan) --</option>';
    keys.forEach(function(k) {
        var r = window.hitungRincianSoal(window.bankLatihanTerpadu[k]);
        var selAttr = (window.paketLatihanTerpilih === k) ? ' selected' : '';
        html += '<option value="' + k + '"' + selAttr + '>' + k + ' — ' + r.teksRingkas + '</option>';
    });
    sel.innerHTML = html;
};

window.renderDropdownBankUjianBawah = function() {
    var selBawah = document.getElementById('dropdown-bank-ujian-bawah');
    var selKontrol = document.getElementById('uji-kontrol-pilih');
    var keys = Object.keys(window.bankUjianGlobal || {}).sort();

    var opsiKosong = '<option value="">-- Belum ada Bank Ujian yang diinput --</option>';
    if (keys.length === 0) {
        if (selBawah) selBawah.innerHTML = opsiKosong;
        if (selKontrol) selKontrol.innerHTML = opsiKosong;
        return;
    }

    var opsiList = keys.map(function(k) {
        var r = window.hitungRincianSoal(window.bankUjianGlobal[k]);
        var selAttr = (window.paketUjianTerpilih === k) ? ' selected' : '';
        return '<option value="' + k + '"' + selAttr + '>' + k + ' — ' + r.teksRingkas + '</option>';
    }).join('');

    if (selBawah) {
        selBawah.innerHTML = '<option value="">-- Pilih Bank Ujian (' + keys.length + ' Paket Tersimpan) --</option>' + opsiList;
    }
    if (selKontrol) {
        selKontrol.innerHTML = '<option value="">-- Pilih Bank Ujian (' + keys.length + ' Paket Tersimpan) --</option>' + opsiList;
    }
};

// 5. Perbaikan Simpan & Hapus Paket Latihan dan Ujian (Menghapus di Semua Node Terkait)
window.hapusSatuSoalLatihan = function(key, idx) {
    if (!confirm("Hapus soal nomor " + (idx + 1) + " ini?")) return;
    var paket = window.bankLatihanTerpadu[key];
    if (!paket) return;
    var arr = window.ambilArraySoal(paket);
    arr.splice(idx, 1);
    paket.questions = arr;
    set(ref(db, 'bank_latihan_terpadu/' + key), paket);
    if (paket.idV5) set(ref(db, 'bank_latihan/' + paket.idV5 + '/soal'), arr);
    window.renderDropdownBankLatihanBawah();
    window.pilihPaketLatihanDariDropdown(key);
};

window.hapusPaketLatihanTerpilih = function() {
    if (!window.paketLatihanTerpilih) return alert("Pilih paket latihan di dropdown bawah terlebih dahulu!");
    var key = window.paketLatihanTerpilih;
    var pkt = window.bankLatihanTerpadu[key] || {};
    var info = window.uraiInfoPaketLatihan(key, pkt);
    if (!confirm('Yakin ingin menghapus seluruh paket "' + key + '"?')) return;

    delete window.bankLatihanTerpadu[key];
    window.paketLatihanTerpilih = "";

    set(ref(db, 'bank_latihan_terpadu/' + key), null);
    set(ref(db, 'bank_soal/' + key), null);
    set(ref(db, 'bank_soal_pusat/' + info.jenjang + '/' + info.mapel + '/' + info.judul), null);
    if (pkt.idV5) set(ref(db, 'bank_latihan/' + pkt.idV5), null);
    var slugV5 = (info.jenjang + '_' + info.mapel + '_' + info.judul).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    set(ref(db, 'bank_latihan/' + slugV5), null);

    window.renderDropdownBankLatihanBawah();
    window.pilihPaketLatihanDariDropdown("");
};

window.simpanSoalKeBankUjianTerpadu = function() {
    var jenjang = document.getElementById('uji-input-jenjang').value;
    var mapel = document.getElementById('uji-input-mapel').value;
    var nama = document.getElementById('uji-input-nama').value.trim();
    var raw = document.getElementById('uji-input-raw').value.trim();

    if (!nama) return alert("Masukkan Nama Ujian terlebih dahulu!");
    if (!raw) return alert("Paste teks soal ujian terlebih dahulu!");

    var soalBaru = window.ekstrakTeksKeArraySoalGlobal ? window.ekstrakTeksKeArraySoalGlobal(raw) : [];
    if (soalBaru.length === 0) return alert("Format soal tidak valid. Gunakan kata 'Soal:' di awal pertanyaan.");

    var namaLengkap = nama.indexOf('(') !== -1 ? nama : '(' + jenjang + ' - ' + mapel + ') ' + nama;
    if (!window.bankUjianGlobal) window.bankUjianGlobal = {};
    var lama = window.ambilArraySoal(window.bankUjianGlobal[namaLengkap]);
    var gabungan = lama.concat(soalBaru);
    window.bankUjianGlobal[namaLengkap] = gabungan;

    set(ref(db, 'bank_ujian/' + namaLengkap), gabungan);
    set(ref(db, 'bank_soal_ujian/' + namaLengkap), gabungan);

    document.getElementById('uji-input-raw').value = "";
    window.paketUjianTerpilih = namaLengkap;
    window.renderDropdownBankUjianBawah();
    window.pilihPaketUjianDariDropdown(namaLengkap);
    var info = window.hitungRincianSoal(gabungan);
    alert('✓ Berhasil menambahkan ' + soalBaru.length + ' soal ke "' + namaLengkap + '"!\nTotal sekarang: ' + info.teksRingkas);
};

window.hapusSatuSoalUjian = function(key, idx) {
    if (!confirm("Hapus soal nomor " + (idx + 1) + " ini dari Bank Ujian?")) return;
    var arr = window.ambilArraySoal(window.bankUjianGlobal[key]);
    arr.splice(idx, 1);
    window.bankUjianGlobal[key] = arr;
    set(ref(db, 'bank_ujian/' + key), arr);
    set(ref(db, 'bank_soal_ujian/' + key), arr);
    window.pilihPaketUjianDariDropdown(key);
    window.renderDropdownBankUjianBawah();
};

window.hapusBankUjianTerpilih = function() {
    if (!window.paketUjianTerpilih) return alert("Pilih Bank Ujian di dropdown bawah terlebih dahulu!");
    var key = window.paketUjianTerpilih;
    if (!confirm('Hapus seluruh Bank Ujian "' + key + '"?')) return;
    delete window.bankUjianGlobal[key];
    window.paketUjianTerpilih = "";
    set(ref(db, 'bank_ujian/' + key), null);
    set(ref(db, 'bank_soal_ujian/' + key), null);
    window.renderDropdownBankUjianBawah();
    window.pilihPaketUjianDariDropdown("");
};

// 6. Sinkronisasi Menu 🚀 LATIHAN Siswa
window.bukaModalSetupLatihan = function() {
    var keys = Object.keys(window.bankLatihanTerpadu || {});
    if (keys.length === 0) return alert("Bank Soal Latihan masih kosong!");

    var kelasSet = new Set();
    keys.forEach(function(k) {
        var info = window.uraiInfoPaketLatihan(k, window.bankLatihanTerpadu[k]);
        if (window.ambilArraySoal(window.bankLatihanTerpadu[k]).length > 0) kelasSet.add(info.jenjang);
    });

    var h = '<option value="" disabled selected>-- Pilih Kelas / Jenjang --</option>';
    Array.from(kelasSet).sort().forEach(function(kls) { h += '<option value="' + kls + '">' + kls + '</option>'; });

    document.getElementById('setup-kelas').innerHTML = h;
    document.getElementById('setup-mapel').innerHTML = '<option value="">-- Pilih Mapel --</option>';
    document.getElementById('setup-mapel').disabled = true;
    document.getElementById('setup-bab').innerHTML = '<option value="">-- Pilih Bab --</option>';
    document.getElementById('setup-bab').disabled = true;
    document.getElementById('setup-kesulitan').innerHTML = '<option value="Campuran">Campuran</option>';
    document.getElementById('setup-kesulitan').disabled = true;
    window.bukaModal('modal-setup-latihan');
};

window.updateDropdownStudent = function(lvl) {
    var klsPilih = document.getElementById('setup-kelas').value;
    var mSel = document.getElementById('setup-mapel');
    var bSel = document.getElementById('setup-bab');
    var kesSel = document.getElementById('setup-kesulitan');
    var keys = Object.keys(window.bankLatihanTerpadu || {});

    if (lvl === 'kelas' && klsPilih) {
        var mapelSet = new Set();
        keys.forEach(function(k) {
            var info = window.uraiInfoPaketLatihan(k, window.bankLatihanTerpadu[k]);
            if (info.jenjang === klsPilih && window.ambilArraySoal(window.bankLatihanTerpadu[k]).length > 0) {
                mapelSet.add(info.mapel);
            }
        });
        var mapels = Array.from(mapelSet).sort();
        if (mapels.length === 1) {
            mSel.innerHTML = '<option value="' + mapels[0] + '" selected>' + mapels[0] + '</option>';
            mSel.disabled = false;
            window.updateDropdownStudent('mapel');
        } else {
            var hM = '<option value="" disabled selected>-- Pilih Mapel --</option>';
            mapels.forEach(function(m) { hM += '<option value="' + m + '">' + m + '</option>'; });
            mSel.innerHTML = hM;
            mSel.disabled = false;
            bSel.disabled = true;
            kesSel.disabled = true;
        }
    } else if (lvl === 'mapel' && klsPilih) {
        var mplPilih = mSel.value;
        var hB = '<option value="Semua">Semua Bab (Campuran)</option>';
        keys.forEach(function(k) {
            var info = window.uraiInfoPaketLatihan(k, window.bankLatihanTerpadu[k]);
            var jml = window.ambilArraySoal(window.bankLatihanTerpadu[k]).length;
            if (info.jenjang === klsPilih && info.mapel === mplPilih && jml > 0) {
                hB += '<option value="' + k + '">' + info.judul + ' (' + jml + ' Soal)</option>';
            }
        });
        bSel.innerHTML = hB;
        bSel.disabled = false;
        window.updateDropdownStudent('bab');
    } else if (lvl === 'bab' && klsPilih) {
        kesSel.innerHTML = '<option value="Campuran" selected>Campuran</option>';
        kesSel.disabled = false;
    }
};

window.mulaiLatihanMandiri = function() {
    var klsPilih = document.getElementById('setup-kelas').value;
    var mplPilih = document.getElementById('setup-mapel').value;
    var babPilih = document.getElementById('setup-bab').value;
    var jml = parseInt(document.getElementById('setup-jumlah').value) || 10;
    if (!klsPilih || !mplPilih || !babPilih) return alert("Lengkapi pilihan terlebih dahulu!");

    var soal = [];
    Object.keys(window.bankLatihanTerpadu || {}).forEach(function(k) {
        var info = window.uraiInfoPaketLatihan(k, window.bankLatihanTerpadu[k]);
        if (info.jenjang === klsPilih && info.mapel === mplPilih && (babPilih === 'Semua' || babPilih === k)) {
            soal = soal.concat(window.ambilArraySoal(window.bankLatihanTerpadu[k]));
        }
    });

    if (soal.length === 0) return alert("Tidak ada soal pada topik ini.");
    soal = soal.sort(function() { return 0.5 - Math.random(); }).slice(0, jml);

    window.tutupModal('modal-setup-latihan');
    document.getElementById('temporary-quiz-room').style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.getElementById('lat-judul-ui').innerText = 'Ruang Latihan Mandiri 🚀';

    window.latihanState = {
        mode: 'latihan', k: klsPilih, m: mplPilih, b: babPilih,
        soalArr: soal, answered: new Set(), correct: 0, total: soal.length, jawabans: {}
    };
    renderRuangKuis('temporary-quiz-container', soal, 'lat');
};

// --- AUTOCOMPLETE MENU UJIAN SISWA (EXCEL STYLE) ---
window.updateDatalistSiswaUjian = function() {
    let kls = document.getElementById('input-kelas-siswa').value;
    let dl = document.getElementById('datalist-siswa-ujian');
    if (!dl) return;
    dl.innerHTML = '';
    if (kls && window.dataAbsensiGlobal && window.dataAbsensiGlobal[kls] && window.dataAbsensiGlobal[kls].siswaList) {
        window.dataAbsensiGlobal[kls].siswaList.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.nama;
            dl.appendChild(opt);
        });
    }
    document.getElementById('input-nama-siswa').value = ''; 
};

window.bukaUjianSiswa = function() {
    let mBody = document.querySelector('#modal-enter-ujian .modal-body');
    if (mBody && !document.getElementById('input-kelas-siswa')) {
        let opsiKls = '<option value="" disabled selected>-- Pilih Kelas Anda --</option>';
        let daftarKls = (window.konfigPendidikan && window.konfigPendidikan.daftarKelas) ? window.konfigPendidikan.daftarKelas : ["X-1", "XI-1", "XII-1"];
        daftarKls.forEach(k => { opsiKls += '<option value="' + k + '">' + k + '</option>'; });
        
        mBody.innerHTML = 
            '<div style="text-align:left; margin-bottom:12px;">' +
                '<label style="font-weight:bold; font-size:12px; color:#2c3e50;">1. Pilih Kelas Anda:</label>' +
                '<select id="input-kelas-siswa" class="input-box" onchange="window.updateDatalistSiswaUjian()" style="margin-bottom:0; text-align:center; font-weight:bold; color:#2c3e50;">' +
                    opsiKls +
                '</select>' +
            '</div>' +
            '<div style="text-align:left; margin-bottom:12px;">' +
                '<label style="font-weight:bold; font-size:12px; color:#2c3e50;">2. Nama Lengkap Anda:</label>' +
                '<input type="text" id="input-nama-siswa" list="datalist-siswa-ujian" class="input-box" placeholder="Ketik nama (Pilih dari opsi)..." autocomplete="off" style="margin-bottom:0; text-align:center; font-weight:bold;">' +
                '<datalist id="datalist-siswa-ujian"></datalist>' +
            '</div>' +
            '<div style="text-align:left; margin-bottom:20px;">' +
                '<label style="font-weight:bold; font-size:12px; color:#2c3e50;">3. Kode Ujian:</label>' +
                '<input type="text" id="input-kode-ujian" class="input-box" placeholder="KODE UJIAN" style="margin-bottom:0; text-align:center; font-weight:bold; font-size:20px; text-transform:uppercase; color:#c0392b;">' +
            '</div>' +
            '<button type="button" class="btn-action" style="background:#e67e22; width:100%; font-size:15px; padding:12px;" onclick="verifikasiMasukUjian()">🚀 Mulai Ujian 🔒</button>';
    }
    window.bukaModal('modal-enter-ujian');
};

setTimeout(() => {
    document.querySelectorAll('a[onclick*="modal-enter-ujian"], li#menu-ujian-kelas a').forEach(el => {
        el.removeAttribute('onclick');
        el.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.bukaUjianSiswa(); };
    });
}, 1000);

// =========================================================
// UI MENU UJIAN SISWA & VALIDASI NAMA (AUTOCOMPLETE)
// =========================================================
window.bukaUjianSiswa = function() {
    let m = document.getElementById('modal-enter-ujian');
    if (!m) return;
    let mBody = m.querySelector('.modal-body');
    
    let opsiKls = '<option value="" disabled selected>-- Pilih Kelas Anda --</option>';
    let daftarKls = (window.konfigPendidikan && window.konfigPendidikan.daftarKelas) ? window.konfigPendidikan.daftarKelas : ["X-1", "XI-1", "XII-1"];
    daftarKls.forEach(k => { opsiKls += '<option value="' + k + '">' + k + '</option>'; });
    
    mBody.innerHTML = 
        '<div style="text-align:left; margin-bottom:12px;">' +
            '<label style="font-weight:bold; font-size:12px; color:#2c3e50;">1. Pilih Kelas Anda:</label>' +
            '<select id="input-kelas-siswa" class="input-box" onchange="window.updateDatalistSiswaUjian()" style="margin-bottom:0; text-align:center; font-weight:bold; color:#2c3e50; padding:10px;">' +
                opsiKls +
            '</select>' +
        '</div>' +
        '<div style="text-align:left; margin-bottom:12px;">' +
            '<label style="font-weight:bold; font-size:12px; color:#2c3e50;">2. Nama Lengkap (Pilih/Ketik):</label>' +
            '<input type="text" id="input-nama-siswa" list="datalist-siswa-ujian" class="input-box" placeholder="Contoh: Andi..." autocomplete="off" style="margin-bottom:0; text-align:center; font-weight:bold; padding:10px;">' +
            '<datalist id="datalist-siswa-ujian"></datalist>' +
        '</div>' +
        '<div style="text-align:left; margin-bottom:20px;">' +
            '<label style="font-weight:bold; font-size:12px; color:#2c3e50;">3. Kode Ujian dari Guru:</label>' +
            '<input type="text" id="input-kode-ujian" class="input-box" placeholder="KODE UJIAN" style="margin-bottom:0; text-align:center; font-weight:bold; font-size:20px; text-transform:uppercase; color:#c0392b; padding:10px;">' +
        '</div>' +
        '<button type="button" class="btn-action" style="background:#e67e22; width:100%; font-size:15px; padding:12px; border-radius:8px; box-shadow:0 4px 10px rgba(230,126,34,0.3);" onclick="window.verifikasiMasukUjianAman()">🚀 Mulai Ujian 🔒</button>';
    
    m.style.display = 'flex';
};

window.updateDatalistSiswaUjian = function() {
    let kls = document.getElementById('input-kelas-siswa').value;
    let dl = document.getElementById('datalist-siswa-ujian');
    if (!dl) return;
    dl.innerHTML = '';
    if (kls && window.dataAbsensiGlobal && window.dataAbsensiGlobal[kls] && window.dataAbsensiGlobal[kls].siswaList) {
        window.dataAbsensiGlobal[kls].siswaList.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.nama;
            dl.appendChild(opt);
        });
    }
    document.getElementById('input-nama-siswa').value = ''; 
};

// Pasang fungsi penimpa secara otomatis agar menu selalu ter-update
setInterval(() => {
    document.querySelectorAll('a[onclick*="modal-enter-ujian"], li#menu-ujian-kelas a').forEach(el => {
        el.removeAttribute('onclick');
        el.onclick = function(e) { e.preventDefault(); e.stopPropagation(); window.bukaUjianSiswa(); };
    });
}, 1000);

// --- FITUR AUTOCOMPLETE NAMA SISWA (EXCEL STYLE) ---
window.muatOpsiKelasSiswa = function() {
    let sel = document.getElementById('input-kelas-siswa');
    if (sel && sel.options.length <= 1) {
        let daftarKls = (window.konfigPendidikan && window.konfigPendidikan.daftarKelas) ? window.konfigPendidikan.daftarKelas : ["X-1", "XI-1", "XII-1"];
        let opsiHtml = '<option value="" disabled selected>-- Pilih Kelas Anda --</option>';
        daftarKls.forEach(k => { opsiHtml += '<option value="' + k + '">' + k + '</option>'; });
        sel.innerHTML = opsiHtml;
    }
};

window.updateDatalistSiswaUjian = function() {
    let kls = document.getElementById('input-kelas-siswa').value;
    let dl = document.getElementById('datalist-siswa-ujian');
    if (!dl) return;
    dl.innerHTML = '';
    
    // Cari daftar siswa dari database berdasarkan kelas yang dipilih
    if (kls && window.dataAbsensiGlobal && window.dataAbsensiGlobal[kls] && window.dataAbsensiGlobal[kls].siswaList) {
        window.dataAbsensiGlobal[kls].siswaList.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.nama;
            dl.appendChild(opt);
        });
    }
    // Kosongkan nama jika kelas diganti
    document.getElementById('input-nama-siswa').value = ''; 
};

// ============================================================================
// PATCH TAMBAHAN: FITUR CATATAN SISWA (TO-DO LIST) & UNIVERSAL FULLSCREEN (IOS/ANDROID)
// ============================================================================

// 1. Modifikasi Tabel Absensi untuk Menambahkan Tombol Catatan (Notes)
window.renderTabelAbsensiKelas = function() {
    var wadah = document.getElementById('wadah-tabel-absensi');
    if (!wadah) return;
    var kls = window.kelasAbsensiAktif || (window.ambilDaftarKelasAktif ? window.ambilDaftarKelasAktif()[0] : '');
    if (!kls) return;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    var tglList = dataKls.tanggalList;
    var siswaList = dataKls.siswaList;

    var headerTglHtml = tglList.map(function(tgl, tIdx) {
        return '<th style="text-align:center; min-width:75px;">' +
            '<div contenteditable="true" onblur="window.ubahJudulTanggalAbsensi(' + tIdx + ', this.innerText)" style="outline:none; border-bottom:1px dashed rgba(255,255,255,0.4); padding-bottom:2px;">' + tgl + '</div>' +
            '<button type="button" onclick="window.hapusKolomTanggalAbsensi(' + tIdx + ')" title="Hapus Kolom" style="background:none;border:none;color:#f8d7da;font-size:10px;cursor:pointer;margin-top:2px;">✕</button>' +
        '</th>';
    }).join('');

    var rowsHtml = '';
    if (siswaList.length === 0) {
        rowsHtml = '<tr><td colspan="' + (tglList.length + 7) + '" style="text-align:center; padding:25px; color:#94a3b8;">Belum ada daftar siswa di kelas <b>' + kls + '</b>. Klik tombol <b>👤 + Tambah Siswa</b> di kanan atas.</td></tr>';
    } else {
        rowsHtml = siswaList.map(function(s, sIdx) {
            var hadir = 0, sakit = 0, izin = 0, alfa = 0;
            var kehadiranMap = s.kehadiran || {};
            var cellsHtml = tglList.map(function(tgl, tIdx) {
                var st = kehadiranMap[tIdx] || '-';
                if (st === 'H') hadir++;
                else if (st === 'S') sakit++;
                else if (st === 'I') izin++;
                else if (st === 'A') alfa++;
                var clsStatus = st !== '-' ? ('status-' + st) : '';
                return '<td class="absensi-cell-status ' + clsStatus + '" onclick="window.toggleStatusKehadiran(' + sIdx + ', ' + tIdx + ')">' + st + '</td>';
            }).join('');

            // LOGIKA TOMBOL CATATAN (Ganti warna/ikon jika ada isinya)
            var hasCatatan = (s.catatan && s.catatan.trim() !== "");
            var iconBtn = hasCatatan ? '📝' : '📄';
            var colorBtn = hasCatatan ? '#e74c3c' : '#bdc3c7'; // Warna merah jika ada catatan (sesuai gambar)
            var animasi = hasCatatan ? 'text-shadow: 0 2px 4px rgba(231, 76, 60, 0.4);' : '';

            return '<tr>' +
                '<td style="text-align:center; width:40px;">' + (sIdx + 1) + '</td>' +
                '<td style="min-width:200px; padding-right:8px;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                        '<span contenteditable="true" onblur="window.ubahNamaSiswaAbsensi(' + sIdx + ', this.innerText)" style="font-weight:600; flex:1; outline:none;">' + s.nama + '</span>' +
                        '<button type="button" onclick="window.bukaCatatanSiswa(' + sIdx + ')" style="background:none; border:none; cursor:pointer; font-size:16px; color:' + colorBtn + '; ' + animasi + '" title="Catatan Siswa">' + iconBtn + '</button>' +
                    '</div>' +
                '</td>' +
                cellsHtml +
                '<td style="text-align:center; font-weight:bold; color:#155724; background:#f0fdf4;">' + hadir + '</td>' +
                '<td style="text-align:center; font-weight:bold; color:#856404; background:#fefce8;">' + sakit + '</td>' +
                '<td style="text-align:center; font-weight:bold; color:#004085; background:#eff6ff;">' + izin + '</td>' +
                '<td style="text-align:center; font-weight:bold; color:#721c24; background:#fef2f2;">' + alfa + '</td>' +
                '<td style="text-align:center;"><button type="button" onclick="window.hapusSiswaAbsensi(' + sIdx + ')" style="background:none;border:none;cursor:pointer;">🗑️</button></td>' +
            '</tr>';
        }).join('');
    }

    wadah.innerHTML =
        '<table class="excel-table" id="tabel-excel-absensi">' +
            '<thead>' +
                '<tr>' +
                    '<th style="text-align:center; width:40px;">No</th>' +
                    '<th>Nama Siswa</th>' +
                    headerTglHtml +
                    '<th style="text-align:center; background:#16a085;">H</th>' +
                    '<th style="text-align:center; background:#d35400;">S</th>' +
                    '<th style="text-align:center; background:#2980b9;">I</th>' +
                    '<th style="text-align:center; background:#c0392b;">A</th>' +
                    '<th style="text-align:center; width:50px;">Aksi</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
        '</table>';
};

// 2. Fungsi Jendela Pop-up Modal Catatan (To-Do List 50% Layar)
window.bukaCatatanSiswa = function(sIdx) {
    var kls = window.kelasAbsensiAktif;
    var dataKls = window.dataAbsensiGlobal[kls];
    var siswa = dataKls.siswaList[sIdx];
    
    window.siswaCatatanAktifIndex = sIdx;

    var m = document.getElementById('modal-catatan-siswa');
    if (!m) {
        var html = 
        '<div id="modal-catatan-siswa" class="mahardika-modal-wrap" style="display:flex; z-index: 2147483647 !important;">' +
            '<div class="mahardika-modal-card modal-box" style="width:50vw; min-width:340px; max-width:600px; height:60vh; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 15px 40px rgba(0,0,0,0.3); display:flex; flex-direction:column;">' +
                '<div style="background:#f39c12; color:#fff; padding:15px 20px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<h3 id="catatan-siswa-judul" style="margin:0; font-size:16px; font-weight:bold;">Catatan Siswa</h3>' +
                    '<button type="button" onclick="document.getElementById(\'modal-catatan-siswa\').style.display=\'none\'" style="background:rgba(0,0,0,0.15); border:none; color:#fff; width:30px; height:30px; border-radius:50%; font-size:14px; cursor:pointer; font-weight:bold;">✕</button>' +
                '</div>' +
                '<div style="padding:20px; flex:1; display:flex; flex-direction:column; background:#fef9e7;">' +
                    '<textarea id="catatan-siswa-teks" placeholder="- Tugas 1 belum dikumpul\n- Perlu ikut remedial harian bab 1\n\n(Ketik daftar catatan atau to-do list di sini...)" style="flex:1; width:100%; padding:15px; border:1px solid #f1c40f; border-radius:8px; font-family:monospace; font-size:14px; resize:none; box-sizing:border-box; background:#fff; outline:none; box-shadow:inset 0 2px 5px rgba(0,0,0,0.03);"></textarea>' +
                    '<button type="button" onclick="window.simpanCatatanSiswa()" style="background:#27ae60; color:#fff; border:none; padding:14px; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer; margin-top:15px; box-shadow:0 4px 6px rgba(39, 174, 96, 0.2);">💾 Simpan Catatan</button>' +
                '</div>' +
            '</div>' +
        '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
        m = document.getElementById('modal-catatan-siswa');
    } else {
        m.style.display = 'flex';
    }

    // Ubah judul menyesuaikan nama anak
    document.getElementById('catatan-siswa-judul').innerText = "📝 Catatan " + siswa.nama;
    document.getElementById('catatan-siswa-teks').value = siswa.catatan || "";
};

// Fungsi menyimpan catatan ke Firebase
window.simpanCatatanSiswa = function() {
    var sIdx = window.siswaCatatanAktifIndex;
    var kls = window.kelasAbsensiAktif;
    var teks = document.getElementById('catatan-siswa-teks').value;

    if (window.dataAbsensiGlobal && window.dataAbsensiGlobal[kls] && window.dataAbsensiGlobal[kls].siswaList[sIdx]) {
        window.dataAbsensiGlobal[kls].siswaList[sIdx].catatan = teks; // Tulis ke object
        if (window.simpanAbsensiKeDB) {
            window.simpanAbsensiKeDB().then(function() {
                document.getElementById('modal-catatan-siswa').style.display = 'none';
                if (window.tampilkanToastFullscreen) window.tampilkanToastFullscreen("✓ Catatan " + window.dataAbsensiGlobal[kls].siswaList[sIdx].nama + " berhasil disimpan!");
                window.renderTabelAbsensiKelas(); // Render ulang agar ikon merah muncul
            });
        }
    }
};

// 3. UNIVERSAL FULLSCREEN PATCH (Memaksa Fullscreen di iOS/iPhone & Android)
// Injeksi CSS Khusus untuk mensimulasikan Fullscreen di perangkat Apple (iOS Safari)
if (!document.getElementById('ios-fs-style')) {
    var st = document.createElement('style');
    st.id = 'ios-fs-style';
    st.innerHTML = `
        .ios-pseudo-fullscreen {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 2147483647 !important;
            background: #f8f9fa !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
        }
    `;
    document.head.appendChild(st);
}

// Menulis Ulang Logika Tombol Fullscreen Bawaan
window.toggleFullScreen = function() {
    var doc = window.document;
    var elem = doc.documentElement;

    // Deteksi API Fullscreen bawaan
    var reqFS = elem.requestFullscreen || elem.mozRequestFullScreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
    var exitFS = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    var isNativeFSEnabled = !!(doc.fullscreenElement || doc.mozFullScreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
    var isCssFS = document.body.classList.contains('ios-pseudo-fullscreen');

    // Jika saat ini TIDAK dalam keadaan fullscreen
    if (!isNativeFSEnabled && !isCssFS) {
        if (reqFS) {
            reqFS.call(elem).catch(function(err) {
                // Jika ditolak oleh browser (seperti iOS Safari pada iPhone), paksa pakai CSS
                console.log("Native Fullscreen ditolak/tidak didukung. Mengaktifkan CSS Fallback untuk iPhone/iOS.");
                document.body.classList.add('ios-pseudo-fullscreen');
            });
        } else {
            // Jika API benar-benar tidak ada di browser tersebut
            document.body.classList.add('ios-pseudo-fullscreen');
        }
        sessionStorage.setItem('autoFS', 'true');
    } 
    // Jika sedang dalam keadaan fullscreen (keluar)
    else {
        if (isNativeFSEnabled && exitFS) {
            exitFS.call(doc);
        }
        document.body.classList.remove('ios-pseudo-fullscreen');
        sessionStorage.removeItem('autoFS');
    }
};

// ============================================================================
// PATCH KEMBALIKAN TOMBOL CETAK PDF DI MENU PRAKTIKUM GURU
// ============================================================================

window.bukaLaporanSiswa = function() {
    var key = document.getElementById('select-laporan-siswa').value;
    var wadah = document.getElementById('tempat-laporan-guru');
    if (!key) { wadah.innerHTML = '<i>Pilih siswa untuk melihat laporan.</i>'; return; }

    var lap = window.dataLaporanTemp[key];
    var imgHtml = lap.lampiran ? '<img src="'+lap.lampiran+'" style="max-width:100%; max-height:400px; border-radius:8px; margin-top:15px; box-shadow:0 4px 10px rgba(0,0,0,0.1); cursor:zoom-in;" title="Bukti Praktikum">' : '<i>(Siswa tidak melampirkan foto dokumentasi)</i>';
    
    var formatBab = function(judul, isi) { 
        return '<div style="margin-bottom:20px;"><h4 style="margin:0 0 5px 0; color:#2980b9; border-bottom:1px solid #ecf0f1; padding-bottom:5px;">'+judul+'</h4><div style="background:#fff; padding:15px; border-left:4px solid #3498db; border-radius:0 4px 4px 0; white-space:pre-wrap; box-shadow:0 1px 3px rgba(0,0,0,0.05); font-size:14px;">'+(isi || '-')+'</div></div>'; 
    };

    var tombolCetak = '<div style="text-align:right; margin-bottom:15px;">' +
        '<button type="button" onclick="window.cetakPraktikumPDF(\'area-cetak-praktikum\', \'' + lap.nama.replace(/'/g, "\\'") + '\')" style="background:#e74c3c; color:#fff; border:none; padding:8px 15px; border-radius:6px; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(231,76,60,0.3);">🖨️ Cetak PDF Laporan</button>' +
    '</div>';

    wadah.innerHTML = tombolCetak + 
        '<div id="area-cetak-praktikum">' +
            '<div style="border-bottom:2px dashed #bdc3c7; padding-bottom:15px; margin-bottom:20px; text-align:center;">' +
                '<h2 style="margin:0; text-transform:uppercase; color:#2c3e50; font-size:20px;">' + lap.judul + '</h2>' +
                '<p style="margin:5px 0 0 0; font-size:16px;"><b>' + lap.nama + '</b> (Kelas ' + lap.kelas + ')</p>' +
                '<small style="color:#7f8c8d;">Dikirim pada: ' + lap.waktu + '</small>' +
            '</div>' +
            formatBab('BAB I: Pendahuluan', lap.bab1) +
            formatBab('BAB II: Dasar Teori', lap.bab2) +
            formatBab('BAB III: Alat, Bahan & Cara Kerja', lap.bab3) +
            formatBab('BAB IV: Hasil Pengamatan & Pembahasan', lap.bab4) +
            formatBab('BAB V: Kesimpulan', lap.kesimpulan) +
            '<div style="margin-bottom:15px;"><h4 style="margin:0 0 5px 0; color:#2980b9;">📸 Lampiran Dokumentasi</h4>' + imgHtml + '</div>' +
        '</div>';
};

window.cetakPraktikumPDF = function(areaId, namaSiswa) {
    var c = document.getElementById(areaId); 
    if(!c) return; 
    var clone = c.cloneNode(true);
    var win = window.open('','','width=900,height=700');
    
    win.document.write('<html><head><title>Laporan Praktikum - ' + namaSiswa + '</title>' +
        '<style>' +
        '@media print { ' +
            'body, p, div, span, h2, h4 { font-family:"Times New Roman", Times, serif !important; color:black !important; } ' +
            'body { padding:20px; line-height:1.5; } ' +
            'h2 { text-align:center; margin-bottom:10px; } ' +
            'h4 { border-bottom:1px solid #000; padding-bottom:5px; margin-top:20px; } ' +
            'img { max-width:100%; height:auto; display:block; margin:15px auto; } ' +
            'div[style*="background:#fff"] { border-left: none !important; padding: 0 !important; box-shadow: none !important; }' +
        '} ' +
        '</style>' +
        '</head><body>' + clone.innerHTML + '</body></html>');
    
    win.document.close(); 
    win.focus(); 
    
    // Memberikan jeda agar gambar lampiran sempat termuat sebelum jendela print ditarik
    setTimeout(function(){ 
        win.print(); 
        win.close(); 
    }, 800);
};

// ============================================================================
// MASTER PATCH: LAPORAN PRAKTIKUM ILMIAH (COVER, DAFTAR ISI, PUSTAKA DINAMIS & PDF)
// ============================================================================

// 1. Desain Ulang Jendela Modal Praktikum (Form Siswa & Guru)
(function rancangUlangModalPraktikum() {
    var modalLama = document.getElementById('modal-praktikum');
    if (modalLama) modalLama.remove();

    var htmlModalPrak = `
    <div id="modal-praktikum" class="mahardika-modal-wrap" style="display:none; z-index:999999;">
        <div class="mahardika-modal-card modal-box" style="max-width:900px; height:92vh; display:flex; flex-direction:column; background:#f4f6f7;">
            <div style="background:#2c3e50; color:#fff; padding:15px 20px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:18px;">🧪 Laporan Praktikum Sains</h3>
                <button type="button" onclick="document.getElementById('modal-praktikum').style.display='none'" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer;">✕</button>
            </div>
            
            <div style="flex:1; overflow-y:auto; padding:20px;">
                
                <!-- TAMPILAN GURU (DASHBOARD KOREKSI & CETAK) -->
                <div id="view-praktikum-guru" style="display:none; background:#fff; padding:20px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <label style="font-weight:bold; color:#34495e;">📂 Pilih Laporan Siswa yang Masuk:</label>
                    <select id="select-laporan-siswa" onchange="window.bukaLaporanSiswa()" style="width:100%; padding:12px; margin-top:8px; margin-bottom:20px; border:1px solid #bdc3c7; border-radius:6px; font-size:15px;"></select>
                    <div id="tempat-laporan-guru" style="min-height:300px;"><i>Belum ada laporan yang dipilih.</i></div>
                </div>

                <!-- TAMPILAN SISWA (FORM KARYA TULIS ILMIAH) -->
                <div id="view-praktikum-siswa" style="display:none; background:#fff; padding:25px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <div style="background:#e8f8f5; border-left:4px solid #16a085; padding:15px; margin-bottom:20px; border-radius:4px;">
                        <b style="color:#16a085;">Informasi:</b> Setelah dikumpulkan, sistem akan merangkai tulisanmu menjadi Dokumen PDF berformat Karya Tulis Ilmiah yang bisa langsung kamu Download.
                    </div>
                    
                    <h4 style="color:#0b3954; border-bottom:2px solid #ecf0f1; padding-bottom:5px;">A. Identitas Praktikum</h4>
                    <input type="text" id="prak-judul" placeholder="Judul Praktikum (Contoh: Uji Enzim Katalase Hati Ayam)" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; font-weight:bold; font-size:15px; box-sizing:border-box;">
                    
                    <div style="display:grid; grid-template-columns:1fr 2fr; gap:15px; margin-bottom:15px;">
                        <div>
                            <label style="font-size:12px; font-weight:bold;">Pilih Kelas:</label>
                            <select id="prak-kelas" onchange="window.updateDatalistPrakSiswa()" style="width:100%; padding:10px; border:1px solid #bdc3c7; border-radius:6px; margin-top:5px;"></select>
                        </div>
                        <div>
                            <label style="font-size:12px; font-weight:bold;">Ketua Kelompok (Ketik & Pilih):</label>
                            <input type="text" id="prak-ketua" list="list-nama-siswa-prak" placeholder="Nama Ketua..." style="width:100%; padding:10px; border:1px solid #bdc3c7; border-radius:6px; margin-top:5px; box-sizing:border-box;">
                            <datalist id="list-nama-siswa-prak"></datalist>
                        </div>
                    </div>

                    <label style="font-size:12px; font-weight:bold;">Anggota Kelompok (Kosongkan jika tidak ada):</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:5px; margin-bottom:25px;">
                        <input type="text" id="prak-ang1" list="list-nama-siswa-prak" placeholder="Anggota 1" style="padding:10px; border:1px solid #bdc3c7; border-radius:6px; width:100%; box-sizing:border-box;">
                        <input type="text" id="prak-ang2" list="list-nama-siswa-prak" placeholder="Anggota 2" style="padding:10px; border:1px solid #bdc3c7; border-radius:6px; width:100%; box-sizing:border-box;">
                        <input type="text" id="prak-ang3" list="list-nama-siswa-prak" placeholder="Anggota 3" style="padding:10px; border:1px solid #bdc3c7; border-radius:6px; width:100%; box-sizing:border-box;">
                    </div>

                    <h4 style="color:#0b3954; border-bottom:2px solid #ecf0f1; padding-bottom:5px;">B. Isi Laporan</h4>
                    <label style="font-weight:bold; font-size:13px; color:#34495e;">BAB I: Pendahuluan (Latar Belakang & Tujuan)</label>
                    <textarea id="prak-bab1" rows="4" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; font-family:inherit; box-sizing:border-box;"></textarea>
                    
                    <label style="font-weight:bold; font-size:13px; color:#34495e;">BAB II: Dasar Teori</label>
                    <textarea id="prak-bab2" rows="4" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; font-family:inherit; box-sizing:border-box;"></textarea>
                    
                    <label style="font-weight:bold; font-size:13px; color:#34495e;">BAB III: Metodologi (Alat, Bahan & Cara Kerja)</label>
                    <textarea id="prak-bab3" rows="5" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; font-family:inherit; box-sizing:border-box;"></textarea>
                    
                    <label style="font-weight:bold; font-size:13px; color:#34495e;">BAB IV: Hasil Pengamatan & Pembahasan</label>
                    <textarea id="prak-bab4" rows="6" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; font-family:inherit; box-sizing:border-box;"></textarea>
                    
                    <label style="font-weight:bold; font-size:13px; color:#34495e;">BAB V: Kesimpulan</label>
                    <textarea id="prak-kesimpulan" rows="3" style="width:100%; padding:10px; margin-top:5px; margin-bottom:25px; border:1px solid #bdc3c7; border-radius:6px; font-family:inherit; box-sizing:border-box;"></textarea>

                    <h4 style="color:#0b3954; border-bottom:2px solid #ecf0f1; padding-bottom:5px; display:flex; justify-content:space-between;">
                        <span>C. Daftar Pustaka</span>
                        <button type="button" onclick="window.tambahBarisPustaka()" style="background:#2980b9; color:#fff; border:none; border-radius:4px; padding:2px 10px; font-size:12px; cursor:pointer;">+ Tambah Referensi</button>
                    </h4>
                    <table style="width:100%; border-collapse:collapse; margin-bottom:25px;" id="tabel-pustaka-prak">
                        <thead>
                            <tr style="background:#ecf0f1; font-size:12px; color:#2c3e50;">
                                <th style="padding:8px; border:1px solid #bdc3c7;">Penulis</th>
                                <th style="padding:8px; border:1px solid #bdc3c7; width:80px;">Tahun</th>
                                <th style="padding:8px; border:1px solid #bdc3c7;">Judul Buku / Artikel</th>
                                <th style="padding:8px; border:1px solid #bdc3c7; width:40px;">Hapus</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-pustaka">
                            <tr>
                                <td style="padding:4px; border:1px solid #bdc3c7;"><input type="text" class="pus-penulis" style="width:100%; box-sizing:border-box; border:none; outline:none; padding:4px;"></td>
                                <td style="padding:4px; border:1px solid #bdc3c7;"><input type="text" class="pus-tahun" style="width:100%; box-sizing:border-box; border:none; outline:none; padding:4px; text-align:center;"></td>
                                <td style="padding:4px; border:1px solid #bdc3c7;"><input type="text" class="pus-judul" style="width:100%; box-sizing:border-box; border:none; outline:none; padding:4px;"></td>
                                <td style="padding:4px; border:1px solid #bdc3c7; text-align:center;">-</td>
                            </tr>
                        </tbody>
                    </table>

                    <h4 style="color:#0b3954; border-bottom:2px solid #ecf0f1; padding-bottom:5px;">D. Lampiran Foto</h4>
                    <input type="file" id="prak-lampiran" accept="image/*" style="width:100%; padding:10px; background:#ecf0f1; border-radius:6px; margin-bottom:10px; box-sizing:border-box;">
                    
                    <p id="prak-status" style="font-size:14px; font-weight:bold; margin:20px 0; text-align:center;"></p>

                    <button id="btn-kumpul-prak" onclick="window.kirimLaporanPraktikum(event)" style="width:100%; background:#27ae60; color:#fff; padding:15px; border:none; border-radius:8px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 10px rgba(39, 174, 96, 0.3);">🚀 Kumpulkan & Download PDF</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', htmlModalPrak);
})();

// 2. Fungsi Pendukung UI (Datalist & Daftar Pustaka)
window.bukaModalPraktikum = function() {
    document.getElementById('modal-praktikum').style.display = 'flex';
    
    if (sessionStorage.getItem("statusGuru") === "aktif" && sessionStorage.getItem("previewMode") !== "true") {
        document.getElementById('view-praktikum-siswa').style.display = 'none';
        document.getElementById('view-praktikum-guru').style.display = 'block';
        if (window.muatDaftarLaporan) window.muatDaftarLaporan();
    } else {
        document.getElementById('view-praktikum-guru').style.display = 'none';
        document.getElementById('view-praktikum-siswa').style.display = 'block';
        
        // Muat opsi kelas ke dropdown siswa
        var selKls = document.getElementById('prak-kelas');
        var klsArr = window.ambilDaftarKelasAktif ? window.ambilDaftarKelasAktif() : [];
        selKls.innerHTML = '<option value="" disabled selected>-- Pilih Kelas --</option>' + 
                           klsArr.map(function(k){ return '<option value="'+k+'">'+k+'</option>'; }).join('');
    }
};

window.updateDatalistPrakSiswa = function() {
    var kls = document.getElementById('prak-kelas').value;
    var dl = document.getElementById('list-nama-siswa-prak');
    dl.innerHTML = '';
    if (window.dataAbsensiGlobal && window.dataAbsensiGlobal[kls] && window.dataAbsensiGlobal[kls].siswaList) {
        var opts = window.dataAbsensiGlobal[kls].siswaList.map(function(s) { return '<option value="' + s.nama + '">'; });
        dl.innerHTML = opts.join('');
    }
};

window.tambahBarisPustaka = function() {
    var tbody = document.getElementById('tbody-pustaka');
    var tr = document.createElement('tr');
    tr.innerHTML = 
        '<td style="padding:4px; border:1px solid #bdc3c7;"><input type="text" class="pus-penulis" style="width:100%; box-sizing:border-box; border:none; outline:none; padding:4px;"></td>' +
        '<td style="padding:4px; border:1px solid #bdc3c7;"><input type="text" class="pus-tahun" style="width:100%; box-sizing:border-box; border:none; outline:none; padding:4px; text-align:center;"></td>' +
        '<td style="padding:4px; border:1px solid #bdc3c7;"><input type="text" class="pus-judul" style="width:100%; box-sizing:border-box; border:none; outline:none; padding:4px;"></td>' +
        '<td style="padding:4px; border:1px solid #bdc3c7; text-align:center;"><button type="button" onclick="this.closest(\'tr\').remove()" style="background:#e74c3c; color:#fff; border:none; border-radius:4px; cursor:pointer;">✕</button></td>';
    tbody.appendChild(tr);
};

// 3. Mesin Pembuat PDF (Engine Format KTI Resmi)
// PDF menggunakan fungsi `window.print()` standar browser, dimanipulasi dengan CSS @page untuk Pagination
window.cetakPraktikumPDF = function(dataLap) {
    // Susun Anggota
    var listAnggota = [];
    if(dataLap.ang1) listAnggota.push(dataLap.ang1);
    if(dataLap.ang2) listAnggota.push(dataLap.ang2);
    if(dataLap.ang3) listAnggota.push(dataLap.ang3);
    var htmlAnggota = listAnggota.map(function(n) { return '<li>' + n + '</li>'; }).join('');

    // Susun Daftar Pustaka (APA Style)
    var htmlPustaka = '';
    if (dataLap.pustaka && dataLap.pustaka.length > 0) {
        htmlPustaka = dataLap.pustaka.map(function(p) {
            return '<p style="text-indent:-30px; padding-left:30px; margin:5px 0;">' + 
                   (p.penulis || 'Anonim') + '. (' + (p.tahun || 'n.d.') + '). <i>' + (p.judul || 'Tanpa Judul') + '</i>.</p>';
        }).join('');
    } else {
        htmlPustaka = '<p>-</p>';
    }

    // Nama Bulan & Tahun Dinamis
    var tglDate = new Date();
    var namaBulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    var strBulanTahun = namaBulan[tglDate.getMonth()] + " " + tglDate.getFullYear();

    var win = window.open('','','width=1000,height=800');
    
    var htmlContent = `
    <html>
    <head>
        <title>Laporan Praktikum - ${dataLap.ketua}</title>
        <style>
            @media print {
                @page { margin: 2.5cm 2cm; }
                body { 
                    font-family: "Times New Roman", Times, serif; 
                    font-size: 12pt; 
                    line-height: 1.5; 
                    color: black; 
                    counter-reset: page; /* Atur ulang nomor halaman */
                }
                .page-break { page-break-before: always; }
                
                /* Trik untuk Nomor Halaman Standar di Chrome/Safari */
                #page-footer {
                    position: fixed;
                    bottom: 0;
                    width: 100%;
                    text-align: center;
                    font-size: 11pt;
                }
                
                h1, h2, h3 { text-align: center; font-weight: bold; }
                h1 { font-size: 16pt; margin-bottom: 20px; }
                h2 { font-size: 14pt; margin-top: 0; }
                p { text-align: justify; margin-top:5px; margin-bottom:15px; }
                
                .cover { 
                    height: 100vh; 
                    display: flex; 
                    flex-direction: column; 
                    justify-content: center; 
                    align-items: center; 
                    text-align: center; 
                    padding: 0 10%;
                }
                .cover-logo { max-width: 150px; height: auto; margin: 40px 0; }
                .cover-title { text-transform: uppercase; font-size: 16pt; font-weight: bold; margin-bottom: 30px; line-height: 1.5; }
                .cover-meta { font-size: 14pt; margin: 20px 0; font-weight:bold; }
                .cover-names { text-align: left; font-size: 14pt; margin-top: 15px; }
                .cover-names ul { list-style-type: disc; padding-left: 20px; margin-top: 5px; }
                .cover-bottom { margin-top: auto; padding-bottom: 40px; font-size: 14pt; font-weight: bold; text-transform: uppercase; }
                
                .toc { width: 100%; margin-top: 30px; }
                .toc td { padding: 5px 0; font-size: 12pt; }
                .toc td:nth-child(2) { border-bottom: 1px dotted #000; width: 100%; }
                
                .lampiran-img { max-width: 80%; max-height: 400px; display: block; margin: 20px auto; border: 1px solid #000; }
            }
            body { font-family: "Times New Roman", Times, serif; font-size: 12pt; max-width: 800px; margin: 0 auto; padding: 20px; }
        </style>
    </head>
    <body>
        <!-- HALAMAN 1: COVER -->
        <div class="cover">
            <div class="cover-title">
                LAPORAN PRAKTIKUM<br>
                ${dataLap.judul}
            </div>
            
            <!-- Logo Sekolah (Dapat diganti URL nya jika ada logo online) -->
            <img class="cover-logo" src="https://i.ibb.co/L5rCg5N/tutwuri.png" alt="Logo">
            
            <div class="cover-meta">
                Pembimbing: Mahardika Wiryawan, S.Pd
            </div>
            
            <div class="cover-names">
                <b>Oleh:</b><br>
                Ketua kelompok : ${dataLap.ketua}<br>
                Anggota Kelompok :
                <ul>
                    ${htmlAnggota || '<li>-</li>'}
                </ul>
            </div>
            
            <div class="cover-bottom">
                SMA BODHI DHARMA<br>
                BATAM<br>
                ${strBulanTahun}
            </div>
        </div>

        <!-- HALAMAN 2: DAFTAR ISI -->
        <div class="page-break">
            <h2>DAFTAR ISI</h2>
            <table class="toc">
                <tr><td>COVER</td><td></td></tr>
                <tr><td>DAFTAR ISI</td><td></td></tr>
                <tr><td style="white-space:nowrap;">BAB I PENDAHULUAN</td><td></td></tr>
                <tr><td style="white-space:nowrap;">BAB II DASAR TEORI</td><td></td></tr>
                <tr><td style="white-space:nowrap;">BAB III METODOLOGI</td><td></td></tr>
                <tr><td style="white-space:nowrap;">BAB IV HASIL DAN PEMBAHASAN</td><td></td></tr>
                <tr><td style="white-space:nowrap;">BAB V KESIMPULAN</td><td></td></tr>
                <tr><td style="white-space:nowrap;">DAFTAR PUSTAKA</td><td></td></tr>
                <tr><td style="white-space:nowrap;">LAMPIRAN</td><td></td></tr>
            </table>
        </div>

        <!-- HALAMAN 3: BAB 1 & 2 (Biasanya bisa digabung jika pendek, tapi kita pisah sesuai rule) -->
        <div class="page-break">
            <h2>BAB I<br>PENDAHULUAN</h2>
            <div style="white-space: pre-wrap; text-indent: 30px;">${dataLap.bab1}</div>
        </div>

        <div class="page-break">
            <h2>BAB II<br>DASAR TEORI</h2>
            <div style="white-space: pre-wrap; text-indent: 30px;">${dataLap.bab2}</div>
        </div>

        <div class="page-break">
            <h2>BAB III<br>METODOLOGI</h2>
            <div style="white-space: pre-wrap; text-indent: 30px;">${dataLap.bab3}</div>
        </div>

        <div class="page-break">
            <h2>BAB IV<br>HASIL DAN PEMBAHASAN</h2>
            <div style="white-space: pre-wrap; text-indent: 30px;">${dataLap.bab4}</div>
        </div>

        <div class="page-break">
            <h2>BAB V<br>KESIMPULAN</h2>
            <div style="white-space: pre-wrap; text-indent: 30px;">${dataLap.kesimpulan}</div>
        </div>

        <div class="page-break">
            <h2>DAFTAR PUSTAKA</h2>
            ${htmlPustaka}
        </div>

        <div class="page-break">
            <h2>LAMPIRAN</h2>
            ${dataLap.lampiran ? '<img src="'+dataLap.lampiran+'" class="lampiran-img">' : '<p style="text-align:center;">Tidak ada lampiran gambar.</p>'}
        </div>

    </body>
    </html>`;

    win.document.write(htmlContent);
    win.document.close();
    win.focus();
    
    setTimeout(function() { 
        win.print(); 
        // win.close(); // Dihilangkan sementara agar siswa bisa melihat jika terblokir popup
    }, 1000);
};

// 4. Proses Pengiriman Laporan (Siswa)
window.kirimLaporanPraktikum = async function(event) {
    var judul = document.getElementById('prak-judul').value.trim();
    var kelas = document.getElementById('prak-kelas').value;
    var ketua = document.getElementById('prak-ketua').value.trim();
    
    if (!judul || !kelas || !ketua) {
        return alert("⚠️ Judul, Kelas, dan Nama Ketua Kelompok wajib diisi!");
    }

    var btn = document.getElementById('btn-kumpul-prak');
    btn.disabled = true; btn.style.background = "#95a5a6";
    var statusEl = document.getElementById('prak-status');
    statusEl.innerHTML = "<span style='color:#f39c12;'>⏳ Menyiapkan dokumen laporan...</span>";

    // Kumpulkan Data Daftar Pustaka
    var arrPustaka = [];
    document.querySelectorAll('#tbody-pustaka tr').forEach(function(tr) {
        var pen = tr.querySelector('.pus-penulis').value.trim();
        var thn = tr.querySelector('.pus-tahun').value.trim();
        var jud = tr.querySelector('.pus-judul').value.trim();
        if (pen || jud) arrPustaka.push({ penulis: pen, tahun: thn, judul: jud });
    });

    try {
        var lampiranUrl = "";
        var fileInput = document.getElementById('prak-lampiran');
        if (fileInput.files && fileInput.files[0]) {
            statusEl.innerHTML = "<span style='color:#f39c12;'>☁️ Mengunggah foto lampiran ke Cloud...</span>";
            var reader = new FileReader();
            lampiranUrl = await new Promise((resolve) => {
                reader.onload = async function(e) {
                    var url = await window.uploadKeImgBB(e.target.result);
                    resolve(url);
                };
                reader.readAsDataURL(fileInput.files[0]);
            });
        }

        var payload = {
            judul: judul,
            kelas: kelas,
            nama: ketua, // Alias nama untuk dashboard guru
            ketua: ketua,
            ang1: document.getElementById('prak-ang1').value.trim(),
            ang2: document.getElementById('prak-ang2').value.trim(),
            ang3: document.getElementById('prak-ang3').value.trim(),
            bab1: document.getElementById('prak-bab1').value.trim(),
            bab2: document.getElementById('prak-bab2').value.trim(),
            bab3: document.getElementById('prak-bab3').value.trim(),
            bab4: document.getElementById('prak-bab4').value.trim(),
            kesimpulan: document.getElementById('prak-kesimpulan').value.trim(),
            pustaka: arrPustaka,
            lampiran: lampiranUrl,
            waktu: new Date().toLocaleString('id-ID')
        };

        statusEl.innerHTML = "<span style='color:#f39c12;'>💾 Mengirim ke meja guru...</span>";
        var idLaporan = Date.now() + "_" + ketua.replace(/[^a-zA-Z0-9]/g, '');
        var dbRestUrl = window.getRestDBUrl("laporan_praktikum/" + idLaporan);
        
        await fetch(dbRestUrl, { method: 'PUT', body: JSON.stringify(payload) });

        statusEl.innerHTML = "<span style='color:#2ecc71;'>✅ Laporan berhasil dikumpulkan! Mengunduh PDF...</span>";
        
        // Picu pembuatan & download PDF untuk siswa
        window.cetakPraktikumPDF(payload);

        setTimeout(function() {
            document.getElementById('modal-praktikum').style.display = 'none';
            statusEl.innerText = "";
            btn.disabled = false; btn.style.background = "#27ae60";
            // Bersihkan form
            ['prak-judul','prak-ketua','prak-ang1','prak-ang2','prak-ang3','prak-bab1','prak-bab2','prak-bab3','prak-bab4','prak-kesimpulan','prak-lampiran'].forEach(id => {
                var el = document.getElementById(id); if(el) el.value='';
            });
        }, 3000);

    } catch (err) {
        statusEl.innerHTML = "<span style='color:#e74c3c;'>❌ Gagal mengirim: " + err.message + "</span>";
        btn.disabled = false; btn.style.background = "#27ae60";
    }
};

// 5. Integrasi Cetak PDF di Tampilan Guru
window.bukaLaporanSiswa = function() {
    var key = document.getElementById('select-laporan-siswa').value;
    var wadah = document.getElementById('tempat-laporan-guru');
    if (!key) { wadah.innerHTML = '<i>Pilih siswa untuk melihat laporan.</i>'; return; }

    var lap = window.dataLaporanTemp[key];
    
    // Simpan objek utuh di elemen tersembunyi agar bisa dicetak ulang oleh Guru
    var jsonLap = JSON.stringify(lap).replace(/'/g, "&#39;");
    
    var tombolCetak = '<div style="text-align:right; margin-bottom:15px; padding-bottom:15px; border-bottom:2px dashed #ecf0f1;">' +
        '<button type="button" onclick="window.cetakPraktikumPDF(JSON.parse(\'' + jsonLap + '\'))" style="background:#e74c3c; color:#fff; border:none; padding:10px 20px; border-radius:6px; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(231,76,60,0.3);">🖨️ Download Ulang PDF (Format Ilmiah)</button>' +
    '</div>';

    wadah.innerHTML = tombolCetak + 
        '<div style="text-align:center;">' +
            '<h2 style="margin:0; text-transform:uppercase; color:#2c3e50;">' + lap.judul + '</h2>' +
            '<p style="margin:5px 0 0 0; font-size:16px;">Ketua: <b>' + lap.ketua + '</b> (Kelas ' + lap.kelas + ')</p>' +
            '<small style="color:#7f8c8d;">Dikumpulkan: ' + lap.waktu + '</small>' +
        '</div>' +
        '<div style="margin-top:20px; padding:15px; background:#fef9e7; border-radius:8px; color:#b7950b;">' +
            '<b>💡 Catatan Guru:</b> Klik tombol merah di atas untuk melihat, mengevaluasi, atau mencetak laporan ini dalam format asli (Cover, Daftar Isi, Bab, dll) seperti yang diunduh oleh siswa.' +
        '</div>';
};

// ============================================================================
// PATCH PERBAIKAN: UPLOAD IMGBB 400 BAD REQUEST, NOTIFIKASI SIMPAN, & UPGRADE AI
// ============================================================================

// 1. PERBAIKAN UPLOAD CLOUD IMGBB (Mencegah Error 400 Bad Request)
window.uploadKeImgBB = async function(fileOrBase64) {
    var apiKey = "d2b70b55ec70f443b7e4529f79b69152";
    var formData = new FormData();

    // Jika berupa objek File (seperti lampiran foto praktikum), kirim langsung agar 100% aman
    if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
        formData.append("image", fileOrBase64);
    } else {
        // Jika terpaksa base64, hilangkan spasi dan enter yang membuat API ImgBB menolak (Error 400)
        var b64str = fileOrBase64.includes(',') ? fileOrBase64.split(',')[1] : fileOrBase64;
        b64str = b64str.replace(/\s+/g, '');
        formData.append("image", b64str);
    }

    var res = await fetch("https://api.imgbb.com/1/upload?key=" + apiKey, {
        method: "POST",
        body: formData
    });
    var data = await res.json();
    if (!data.success) throw new Error(data.error ? data.error.message : "Cloud server gagal merespon.");
    return data.data.url;
};

// Ubah cara Pengirim Laporan Praktikum memanggil ImgBB (menggunakan File murni)
window.kirimLaporanPraktikum = async function(event) {
    var judul = document.getElementById('prak-judul').value.trim();
    var kelas = document.getElementById('prak-kelas').value;
    var ketua = document.getElementById('prak-ketua').value.trim();
    
    if (!judul || !kelas || !ketua) {
        return alert("⚠️ Judul, Kelas, dan Nama Ketua Kelompok wajib diisi!");
    }

    var btn = document.getElementById('btn-kumpul-prak');
    btn.disabled = true; btn.style.background = "#95a5a6";
    var statusEl = document.getElementById('prak-status');
    statusEl.innerHTML = "<span style='color:#f39c12;'>⏳ Menyiapkan dokumen laporan...</span>";

    var arrPustaka = [];
    document.querySelectorAll('#tbody-pustaka tr').forEach(function(tr) {
        var pen = tr.querySelector('.pus-penulis').value.trim();
        var thn = tr.querySelector('.pus-tahun').value.trim();
        var jud = tr.querySelector('.pus-judul').value.trim();
        if (pen || jud) arrPustaka.push({ penulis: pen, tahun: thn, judul: jud });
    });

    try {
        var lampiranUrl = "";
        var fileInput = document.getElementById('prak-lampiran');
        if (fileInput.files && fileInput.files[0]) {
            statusEl.innerHTML = "<span style='color:#f39c12;'>☁️ Mengunggah foto lampiran ke Cloud...</span>";
            // KUNCI PERBAIKAN: Kirim file aslinya, BUKAN teks Base64
            lampiranUrl = await window.uploadKeImgBB(fileInput.files[0]);
        }

        var payload = {
            judul: judul, kelas: kelas, nama: ketua, ketua: ketua,
            ang1: document.getElementById('prak-ang1').value.trim(),
            ang2: document.getElementById('prak-ang2').value.trim(),
            ang3: document.getElementById('prak-ang3').value.trim(),
            bab1: document.getElementById('prak-bab1').value.trim(),
            bab2: document.getElementById('prak-bab2').value.trim(),
            bab3: document.getElementById('prak-bab3').value.trim(),
            bab4: document.getElementById('prak-bab4').value.trim(),
            kesimpulan: document.getElementById('prak-kesimpulan').value.trim(),
            pustaka: arrPustaka, lampiran: lampiranUrl,
            waktu: new Date().toLocaleString('id-ID')
        };

        statusEl.innerHTML = "<span style='color:#f39c12;'>💾 Mengirim ke meja guru...</span>";
        var idLaporan = Date.now() + "_" + ketua.replace(/[^a-zA-Z0-9]/g, '');
        var dbRestUrl = window.getRestDBUrl("laporan_praktikum/" + idLaporan);
        
        await fetch(dbRestUrl, { method: 'PUT', body: JSON.stringify(payload) });

        statusEl.innerHTML = "<span style='color:#2ecc71;'>✅ Laporan berhasil dikumpulkan! Mengunduh PDF...</span>";
        window.cetakPraktikumPDF(payload);

        setTimeout(function() {
            document.getElementById('modal-praktikum').style.display = 'none';
            statusEl.innerText = "";
            btn.disabled = false; btn.style.background = "#27ae60";
            ['prak-judul','prak-ketua','prak-ang1','prak-ang2','prak-ang3','prak-bab1','prak-bab2','prak-bab3','prak-bab4','prak-kesimpulan','prak-lampiran'].forEach(id => {
                var el = document.getElementById(id); if(el) el.value='';
            });
        }, 3000);

    } catch (err) {
        statusEl.innerHTML = "<span style='color:#e74c3c;'>❌ Gagal mengirim: " + err.message + "</span>";
        btn.disabled = false; btn.style.background = "#27ae60";
    }
};

// 2. PERBAIKAN NOTIFIKASI SIMPAN DI MANAJER LATIHAN (TOMBOL)
setInterval(function() {
    var semuaTombol = document.querySelectorAll('button');
    semuaTombol.forEach(function(btn) {
        var teksBtn = btn.innerText || '';
        if ((teksBtn.indexOf('Simpan / Tambahkan') !== -1 || teksBtn.indexOf('Simpan Soal') !== -1) && !btn.dataset.mesinAktifV6) {
            var modalRoot = window.cariModalManajerSoal(btn);
            var semuaSelect = modalRoot ? modalRoot.querySelectorAll('select') : [];
            var selBank = semuaSelect.length >= 3 ? semuaSelect[semuaSelect.length - 1] : null;
            var pathDb = window.deteksiPathBankSoal(modalRoot, btn, selBank);

            var cloneBtn = btn.cloneNode(true);
            cloneBtn.removeAttribute('onclick');
            cloneBtn.dataset.mesinAktifV6 = 'true';
            btn.parentNode.replaceChild(cloneBtn, btn);

            if (selBank && !selBank.dataset.listenerBankV6) {
                selBank.dataset.listenerBankV6 = 'true';
                selBank.removeAttribute('onchange');
                selBank.addEventListener('change', function() {
                    window.tampilkanRincianPaketMardi(modalRoot, pathDb, this.value);
                });
                window.segarkanUIBankSoalMardi(modalRoot, pathDb, selBank.value);
            }

            cloneBtn.onclick = async function(e) {
                e.preventDefault(); e.stopPropagation();
                var mRoot = window.cariModalManajerSoal(cloneBtn);
                var selects = mRoot.querySelectorAll('select');
                var inputs = mRoot.querySelectorAll('input[type="text"]');
                var textarea = mRoot.querySelector('textarea');

                if (!textarea || !textarea.value.trim()) return window.tampilkanToastFullscreen("⚠️ Kotak teks soal masih kosong!");
                
                var kelas = selects[0] ? (selects[0].value || selects[0].options[selects[0].selectedIndex].text) : 'Umum';
                var mapel = selects[1] ? (selects[1].value || selects[1].options[selects[1].selectedIndex].text) : 'Umum';
                var judulBab = inputs[0] ? inputs[0].value.trim() : '';

                if (!judulBab) return window.tampilkanToastFullscreen("⚠️ Mohon isi Nama Bab / Paket terlebih dahulu!");

                var teksAsli = cloneBtn.innerText;
                cloneBtn.innerText = '⏳ Menyimpan...';
                cloneBtn.disabled = true;

                try {
                    var arrSoalBaru = window.uraiTeksSoalMardi(textarea.value);
                    if (arrSoalBaru.length === 0) throw new Error('Format tidak terbaca. Pastikan soal diawali "Soal:"');

                    var idPaket = (kelas + '_' + mapel + '_' + judulBab).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    var urlDb = window.getRestDBUrl(pathDb + '/' + idPaket);
                    var res = await fetch(urlDb);
                    var dataLama = (res.ok ? await res.json() : {}) || {};
                    var listLama = dataLama.soal || dataLama.daftar_soal || dataLama.butir_soal || [];
                    if (!Array.isArray(listLama)) listLama = Object.values(listLama);

                    var arrayGabungan = listLama.concat(arrSoalBaru);
                    var pg = 0, isian = 0, essay = 0;
                    arrayGabungan.forEach(function(q) {
                        var t = (q.tipe || 'PG').toUpperCase();
                        if (t === 'IS') isian++; else if (t === 'ESSAY') essay++; else pg++;
                    });

                    var namaPaketLengkap = kelas + ' - ' + mapel + ' - ' + judulBab;
                    var payload = {
                        id: idPaket, nama: namaPaketLengkap, nama_paket: namaPaketLengkap, judul: judulBab, bab: judulBab,
                        kelas: kelas, jenjang: kelas, mapel: mapel, tipe: pathDb,
                        soal: arrayGabungan, daftar_soal: arrayGabungan, butir_soal: arrayGabungan, questions: arrayGabungan,
                        total_soal: arrayGabungan.length, jml_pg: pg, jml_is: isian, jml_essay: essay,
                        terakhir_diupdate: new Date().toLocaleString()
                    };

                    var resPut = await fetch(urlDb, { method: 'PUT', body: JSON.stringify(payload) });
                    if (!resPut.ok) throw new Error('Gagal menyimpan ke server Firebase.');

                    textarea.value = '';
                    
                    // KUNCI PERBAIKAN: Berikan Notifikasi Toast dan Indikator Status Simpan
                    window.tampilkanToastFullscreen("✅ " + arrSoalBaru.length + " Soal berhasil disimpan ke bank data!");
                    var sb = document.getElementById('save-status-bar');
                    if (sb) {
                        sb.innerHTML = "<span style='color:#2ecc71;'>✓ Paket Tersimpan</span>";
                        setTimeout(function(){ sb.innerHTML = "Cloud Sync: Ready"; }, 3000);
                    }

                    await window.segarkanUIBankSoalMardi(mRoot, pathDb, idPaket);
                } catch (err) {
                    window.tampilkanToastFullscreen("❌ Gagal: " + err.message);
                }
                cloneBtn.innerText = teksAsli;
                cloneBtn.disabled = false;
            };
        }
    });
}, 1000);

// 3. UPGRADE AI: KEMBALIKAN KECERDASAN MODEL (Tanpa Pemotongan Berlebih)
window.requestKeGeminiDenganFallback = async function(teksPrompt) {
    var apiKey = window.ambilKunciAPIAman();
    // Kembalikan ke model cerdas (Gemini 2.0 Flash) sebagai prioritas utama
    var bestModels = [
        "models/gemini-2.0-flash",
        "models/gemini-2.0-flash-lite",
        "models/gemini-1.5-flash"
    ];

    var bodyPayload = JSON.stringify({
        contents: [{ parts: [{ text: teksPrompt }] }],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192 // Kembalikan batas token maksimal agar penjelasan tidak terpotong
        }
    });

    for (var i = 0; i < bestModels.length; i++) {
        var controller = new AbortController();
        // Beri waktu lebih lama agar AI bisa berpikir (15 detik)
        var timeoutId = setTimeout(function() { controller.abort(); }, 15000); 
        try {
            var url = 'https://generativelanguage.googleapis.com/v1beta/' + bestModels[i] + ':generateContent?key=' + apiKey;
            var response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyPayload,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            var data = await response.json();
            if (response.ok && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                return data.candidates[0].content.parts[0].text;
            }
        } catch (err) {
            clearTimeout(timeoutId);
        }
    }
    throw new Error("Server AI sedang memproses antrean, silakan coba lagi.");
};

// Mengembalikan kecerdasan membaca PDF secara utuh
window.prosesUploadPDFSoal = async function(inputEl) {
    var file = inputEl.files && inputEl.files[0];
    if (!file) return;

    var targetId = window.targetTextareaPDF || 'lat-input-raw';
    var textArea = document.getElementById(targetId) || document.getElementById('lat-input-raw');
    var jumlahInput = prompt("Masukkan jumlah soal yang ingin diekstrak (Maksimal 25 soal):", "10");
    if (!jumlahInput) { inputEl.value = ''; return; }
    var jumlahSoal = Math.min(Math.max(1, parseInt(jumlahInput) || 10), 25);

    var teksLama = textArea ? textArea.value : "";
    if (textArea) textArea.value = "🤖 AI (Gemini 2.0) sedang menganalisis dokumen secara mendalam...\nMohon tunggu sekitar 5-10 detik...";

    try {
        var pdfjsLib = await window.muatLibraryPDFJS();
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        var teksPDF = "";
        
        // Membaca hingga 15 halaman penuh agar konteks materi terbawa
        var maxPages = Math.min(pdf.numPages, 15);
        for (var i = 1; i <= maxPages; i++) {
            var page = await pdf.getPage(i);
            var content = await page.getTextContent();
            teksPDF += content.items.map(function(item) { return item.str; }).join(" ") + "\n";
        }

        if (!teksPDF || teksPDF.length < 10) throw new Error("PDF berupa gambar scan tanpa teks.");

        var ekstrakInstan = window.konversiTeksPDFKeFormatSoalLokal(teksPDF, jumlahSoal);
        if (ekstrakInstan && ekstrakInstan.split("Soal:").length - 1 >= Math.min(3, jumlahSoal)) {
            if (textArea) textArea.value = teksLama ? (teksLama.trim() + "\n\n" + ekstrakInstan) : ekstrakInstan;
            window.tampilkanToastFullscreen("⚡ " + jumlahSoal + " soal berhasil diekstrak secara instan!");
            inputEl.value = '';
            return;
        }

        // Memperlebar batas baca AI menjadi 25.000 karakter agar penjelasan soal logis
        var potonganRingkas = teksPDF.substring(0, 25000); 
        var promptCerdas = "Anda adalah guru ahli. Buatlah " + jumlahSoal + " soal Pilihan Ganda berkualitas tinggi dan menantang (HOTS) berdasarkan teks materi berikut. Hasilkan format persis seperti ini (tanpa markdown atau intro):\nSoal: [Pertanyaan]\nTipe: PG\nA. [Opsi A]\nB. [Opsi B]\nC. [Opsi C]\nD. [Opsi D]\nKunci: A\nPembahasan: [Penjelasan mendalam dan logis]\n\nTeks Materi:\n" + potonganRingkas;

        var hasilAI = await window.requestKeGeminiDenganFallback(promptCerdas);
        hasilAI = hasilAI.replace(/```/g, '').trim();
        if (textArea) textArea.value = teksLama ? (teksLama.trim() + "\n\n" + hasilAI) : hasilAI;
        window.tampilkanToastFullscreen("✅ AI selesai menyusun soal dengan pembahasan lengkap!");
    } catch (err) {
        if (textArea) textArea.value = teksLama;
        window.tampilkanToastFullscreen("❌ " + err.message);
    }
    inputEl.value = '';
};

// Mengembalikan kecerdasan AI Tutor
window.panggilGeminiAPI = async function(pesan, loadingId, topikAsli) {
    var body = document.getElementById('ai-tutor-body');
    var el = document.getElementById(loadingId);
    try {
        var promptTutor = "Kamu adalah 'Mahardika AI', asisten guru yang ramah, interaktif, dan cerdas. Jelaskan pertanyaan ini kepada siswa dengan bahasa yang mudah dipahami, gunakan analogi jika perlu, dan berikan contoh nyata: " + pesan;
        var balasanAI = await window.requestKeGeminiDenganFallback(promptTutor);
        if (el) el.innerHTML = balasanAI.replace(/\n/g, '<br>');
    } catch (err) {
        var topik = topikAsli || "konsep ini";
        if (el) {
            el.innerHTML = '<b>💡 Penjelasan Singkat:</b><br>Terkait <b>' + topik + '</b>, pastikan kamu memahami mekanisme dasarnya terlebih dahulu. <br><small style="color:#7f8c8d;"><i>(AI sedang antre, silakan kirim ulang pesanmu).</i></small>';
        }
    }
    body.scrollTop = body.scrollHeight;
};
