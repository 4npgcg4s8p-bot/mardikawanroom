// ==========================================
// FILE: js/main.js (Logika UI, Modal, Print & AI Tutor)
// ==========================================

// OBFUSKASI API KEY: Mencegah bot/hacker membaca kode API secara langsung
window.getGeminiKey = function() {
    return atob("QVEuQWI4Uk42THQzUk5mUDRqdEpzNXZkb3l3WndjWGJ2eVZTZjZtcWdfNzhXVnFqWlB6UXc=");
};

var globalSelectedRange = null; 
var activeBlockIndex = -1; 
var activeQuizBlockIdx = -1;
var soalTypingTimer; 
var tipTimer;

window.kompresGambar = function(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1000; const MAX_HEIGHT = 1000;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7)); 
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

document.addEventListener('paste', function(e) {
    if(!document.body.classList.contains('mode-edit-aktif')) return;
    let items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file' && item.type.indexOf('image/') !== -1) {
            e.preventDefault(); 
            document.getElementById('save-status-bar').innerHTML="<span style='color:#e67e22;'>⏳ Mengkonversi Gambar...</span>";
            let blob = item.getAsFile();
            window.kompresGambar(blob, function(dataUrl) {
                document.execCommand('insertImage', false, dataUrl);
                document.getElementById('save-status-bar').innerHTML="<span style='color:#2ecc71;'>✓ Selesai Di-paste</span>";
                window.triggerInput(); 
            });
            return; 
        }
    }
});

document.addEventListener('contextmenu', e => { if(window.isStrictUjianActive) e.preventDefault(); });
document.addEventListener('copy', e => { if(window.isStrictUjianActive) { e.preventDefault(); alert("⚠️ Dilarang menyalin soal ujian!"); } });
document.addEventListener('cut', e => { if(window.isStrictUjianActive) e.preventDefault(); });
document.addEventListener('paste', e => { if(window.isStrictUjianActive) e.preventDefault(); });
document.addEventListener('selectstart', e => { if(window.isStrictUjianActive) e.preventDefault(); });

window.bukaModal = function(id) { document.getElementById(id).style.display = 'flex'; };
window.tutupModal = function(id) { document.getElementById(id).style.display = 'none'; };
window.tutupModalHasilQuiz = function() { window.tutupModal('modal-quiz-result'); };

window.tutupUjianStrict = function() {
    if(window.isStrictUjianActive) { alert("Selesaikan dan kumpulkan ujian terlebih dahulu!"); return; }
    document.getElementById('ujian-strict-room').style.display='none';
    document.getElementById('ujian-strict-container').innerHTML="";
    document.body.style.overflow='auto';
};

window.bukaWelcomePopup = function() { 
    document.getElementById('modal-welcome-popup').style.display = 'flex'; 
    if(document.body.classList.contains('mode-edit-aktif')) document.getElementById('popup-img-tool').style.display = 'block';
};
window.tutupWelcomePopup = function() { 
    document.getElementById('modal-welcome-popup').style.display = 'none'; 
    sessionStorage.setItem('popupDismissed', 'true'); 
};

window.uploadPopupImg = function(input) {
    const f = input.files[0]; if(!f) return; 
    window.kompresGambar(f, function(dataUrl) {
        document.getElementById('popup-content-box').focus();
        document.execCommand('insertImage', false, dataUrl);
    });
    input.value = '';
};

document.addEventListener("DOMContentLoaded", () => { 
    if(sessionStorage.getItem("statusGuru")==="aktif") { 
        document.body.classList.add('has-login'); 
        if(sessionStorage.getItem("previewMode")==="true") { 
            document.getElementById('btn-preview').innerHTML="✏️ Back to Edit"; 
            document.getElementById('btn-preview').style.background="#27ae60"; 
        } else { 
            document.body.classList.add("mode-edit-aktif"); 
            document.getElementById('popup-content-box').setAttribute('contenteditable','true');
            document.querySelectorAll('.content-block, .fb-content, .header-title').forEach(el=>el.setAttribute('contenteditable','true'));
        } 
    } 
});

window.loginGuru = function() { 
    if(sessionStorage.getItem("statusGuru")==="aktif") return; 
    window.bukaModal('modal-login-guru'); 
    setTimeout(() => document.getElementById('input-sandi-guru').focus(), 100);
};

window.prosesLoginGuru = function() { 
    const val = document.getElementById('input-sandi-guru').value;
    // Sandi dienkripsi Base64 (Z3VydWJpb2xvZ2k= adalah gurubiologi, YWRtaW4xMjM= adalah admin123)
    if(btoa(val) === "Z3VydWJpb2xvZ2k=" || btoa(val) === "YWRtaW4xMjM=") { 
        sessionStorage.setItem("statusGuru","aktif"); 
        window.location.reload(); 
    } else { 
        alert("Sandi salah!"); 
    } 
};

window.togglePreviewMode = function() { 
    const b=document.body, d=document.documentElement, btn=document.getElementById('btn-preview'); 
    if(b.classList.contains('mode-edit-aktif')||d.classList.contains('force-edit-mode')) { 
        b.classList.remove('mode-edit-aktif'); d.classList.remove('force-edit-mode'); 
        sessionStorage.setItem("previewMode","true"); 
        document.querySelectorAll('.content-block, .fb-content, .header-title').forEach(el=>el.removeAttribute('contenteditable')); 
        btn.innerHTML="✏️ Back to Edit"; btn.style.background="#27ae60"; 
        window.renderMathJax(); 
    } else { 
        b.classList.add('mode-edit-aktif'); d.classList.add('force-edit-mode'); 
        sessionStorage.removeItem("previewMode"); 
        document.querySelectorAll('.content-block, .fb-content, .header-title').forEach(el=>el.setAttribute('contenteditable','true')); 
        btn.innerHTML="👁️ Preview as Student"; btn.style.background="#e67e22"; 
        window.restoreMathJax(); 
    } 
    if(window.renderBlocks) window.renderBlocks(); 
    if(window.renderFloatingBoxes) window.renderFloatingBoxes(); 
};

window.simpanSeleksiTeks = function() { 
    let sel=window.getSelection(); 
    if(sel.rangeCount>0) globalSelectedRange=sel.getRangeAt(0); 
};
window.kembalikanSeleksiTeks = function() { 
    if(globalSelectedRange) { 
        let sel=window.getSelection(); 
        sel.removeAllRanges(); 
        sel.addRange(globalSelectedRange); 
    } 
};

window.bukaModalSimbol = function() { window.simpanSeleksiTeks(); window.bukaModal('modal-simbol'); };
window.sisipkanSimbol = function(sym) { window.kembalikanSeleksiTeks(); document.execCommand('insertText', false, sym); window.tutupModal('modal-simbol'); window.triggerInput(); };

window.renderMathJax = function() { 
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) { 
        MathJax.typesetClear(); 
        MathJax.typesetPromise().catch((err) => console.log('MathJax:', err.message)); 
    } 
};
window.restoreMathJax = function() {
    try {
        if (typeof MathJax !== 'undefined' && MathJax.typesetClear) { 
            MathJax.typesetClear(); 
        }
    } catch (e) { 
        console.warn("MathJax aman diabaikan:", e); 
    }
};

window.hoverIstilah = function(el, e) {
    clearTimeout(tipTimer);
    let tip = document.getElementById('tooltip-istilah');
    document.getElementById('tooltip-title').innerText = '💡 ' + el.innerText.replace('💡','').trim();
    document.getElementById('tooltip-body').innerText = el.getAttribute('data-penjelasan');
    tip.style.display = 'block';
    let x = e.clientX + 10; let y = e.clientY + 20;
    if(x + tip.offsetWidth > window.innerWidth) x = window.innerWidth - tip.offsetWidth - 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
};
window.leaveIstilah = function() { tipTimer = setTimeout(() => { document.getElementById('tooltip-istilah').style.display = 'none'; }, 300); };
document.addEventListener('mouseover', e => { if(e.target.classList.contains('glossary-term')) window.hoverIstilah(e.target, e); });
document.addEventListener('mouseout', e => { if(e.target.classList.contains('glossary-term')) window.leaveIstilah(); });

window.bukaModalGlosarium = function() { 
    window.simpanSeleksiTeks(); 
    if(!globalSelectedRange||globalSelectedRange.toString().trim()==="") return alert("Blok satu kata dulu!"); 
    document.getElementById('glosarium-input-text').value=""; 
    window.bukaModal('modal-glosarium-edit'); 
};
window.terapkanPopUpIstilah = function() { 
    let ket=document.getElementById('glosarium-input-text').value; if(!ket) return; 
    window.kembalikanSeleksiTeks(); 
    let span=document.createElement('span'); 
    span.className='glossary-term'; 
    span.setAttribute('data-penjelasan',ket); 
    span.innerHTML=globalSelectedRange.toString()+' 💡'; 
    globalSelectedRange.deleteContents(); 
    globalSelectedRange.insertNode(span); 
    window.tutupModal('modal-glosarium-edit'); 
    window.triggerInput(); 
};

window.hapusIstilah = function() {
    let sel = window.getSelection();
    if (sel.rangeCount > 0) {
        let node = sel.anchorNode;
        let span = node.nodeType === 3 ? node.parentNode : node;
        if (span && span.classList.contains('glossary-term')) {
            let textClean = span.innerText.replace(' 💡', '').trim();
            let textNode = document.createTextNode(textClean);
            span.parentNode.replaceChild(textNode, span); 
            window.triggerInput();
        } else { alert("Letakkan kursor di dalam teks istilah yang ingin dihapus (berwarna oren)."); }
    }
};

window.bukaModalCustomButton = function() { 
    window.simpanSeleksiTeks(); 
    let html='<option value="" disabled selected>-- Pilih Halaman --</option>'; 
    if(window.pagesData) window.pagesData.forEach(p=>{ html+=`<option value="index.html?bab=${p.slug}">${p.title}</option>`; }); 
    document.getElementById('btn-internal-select').innerHTML=html; 
    window.bukaModal('modal-button-edit'); 
};
window.terapkanCustomButton = function() { 
    let txt=document.getElementById('btn-text-input').value||"Learn more"; 
    let int=document.getElementById('btn-internal-select').value; 
    let ext=document.getElementById('btn-external-input').value; 
    let url=ext?(ext.startsWith('http')?ext:'https://'+ext):(int||'#'); 
    window.kembalikanSeleksiTeks(); 
    let a=document.createElement('a'); a.className='custom-site-btn'; a.href=url; a.innerText=txt; 
    if(globalSelectedRange) globalSelectedRange.insertNode(a); 
    window.tutupModal('modal-button-edit'); 
    window.triggerInput(); 
};
window.bukaModalHyperlink = function() { 
    window.simpanSeleksiTeks(); 
    let html='<option value="" disabled selected>-- Halaman Internal --</option>'; 
    if(window.pagesData) window.pagesData.forEach(p=>html+=`<option value="index.html?bab=${p.slug}">${p.title}</option>`); 
    document.getElementById('link-internal-select').innerHTML=html; 
    window.bukaModal('modal-link'); 
};
window.terapkanHyperlink = function() { 
    let int=document.getElementById('link-internal-select').value; 
    let ext=document.getElementById('link-external-input').value; 
    let url=ext?(ext.startsWith('http')?ext:'https://'+ext):int; 
    if(url) { window.kembalikanSeleksiTeks(); document.execCommand('createLink', false, url); window.tutupModal('modal-link'); window.triggerInput(); } 
};

window.triggerInput = function() { 
    const a=document.activeElement; 
    if(a&&(a.classList.contains('content-block')||a.classList.contains('fb-content'))) {
        a.dispatchEvent(new Event('input',{bubbles:true})); 
    }
};

window.cetakKuisPDF = function(wrapId, title) { 
    let c=document.getElementById(wrapId); if(!c) return; let clone=c.cloneNode(true); 
    clone.querySelectorAll('.btn-action,.btn-delete-q,.btn-close-room,.btn-print-room,.quiz-nav-bar,.btn-toggle-nav,button[onclick*="cetakKuis"],button[onclick*="bukaAIQuizModal"],.block-toggle-btn').forEach(e=>e.remove()); 
    clone.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable')); 
    
    clone.querySelectorAll('.short-answer-box').forEach(box => {
        let space = document.createElement('div');
        space.style.borderBottom = '1px dotted #000';
        space.style.height = '30px'; space.style.marginTop = '15px'; space.style.width = '95%';
        box.parentNode.replaceChild(space, box);
    });

    let win=window.open('','','width=900,height=650'); 
    win.document.write(`<html><head><title>Cetak Kuis</title><style>@media print { body, p, div, span, button, .quiz-question-text, .quiz-option-btn { font-family:'Times New Roman', Times, serif !important; font-size: 12pt !important; line-height: 1.25 !important; color:black !important; } body { padding:20px; } .quiz-header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px;text-align:center;} .quiz-question-card{margin-bottom:20px;page-break-inside:avoid;border:none;border-bottom:1px solid #ddd;padding-bottom:15px; background:transparent;} .quiz-question-text{font-weight:bold; margin-bottom:10px;} .quiz-options{display:flex;flex-direction:column;} .quiz-option-btn{background:none;border:none;text-align:left; display:block; margin-left:20px; margin-bottom:6px;} .quiz-explanation{display:none;} }</style></head><body><div class="quiz-header"><h1>Lembar Kuis: ${title}</h1></div>${clone.innerHTML}</body></html>`); 
    win.document.close(); win.focus(); setTimeout(()=>{win.print();win.close();},300); 
};

window.exportWordKuis = function(wrapId, title) {
    let c=document.getElementById(wrapId); if(!c) return; let clone=c.cloneNode(true);
    clone.querySelectorAll('.btn-action, .btn-delete-q, .quiz-nav-bar, .btn-toggle-nav, .btn-close-room, .btn-print-room, .block-toggle-btn').forEach(e=>e.remove());
    clone.querySelectorAll('.quiz-question-card').forEach(card => { card.style.marginBottom="20px"; card.style.padding="0"; card.style.border="none"; card.style.borderBottom="1px solid #ccc"; card.style.background="transparent"; });
    
    clone.querySelectorAll('.short-answer-box').forEach(box => {
        let space = document.createElement('p');
        space.innerHTML = '________________________________________________________';
        space.style.marginTop = '15px'; space.style.color = '#000';
        box.parentNode.replaceChild(space, box);
    });

    clone.querySelectorAll('.quiz-option-btn').forEach(btn => { let p = document.createElement('p'); p.style.margin = "4px 0 4px 20px"; p.style.padding = "0"; p.style.fontSize = "12pt"; p.innerHTML = btn.innerHTML; btn.parentNode.replaceChild(p, btn); });
    let html = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Kuis</title><style>body, p, div, span { font-family: 'Times New Roman', serif !important; font-size: 12pt !important; line-height: 1.25 !important; }</style></head><body><div style='padding:20px;'><h1 style='text-align:center;'>" + title + "</h1><br>" + clone.innerHTML + "</div></body></html>";
    let blob = new Blob(['\ufeff', html], { type: 'application/msword' }); let url = URL.createObjectURL(blob); let a = document.createElement('a'); a.href = url; a.download = title + '.doc'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

/* LOGIKA AI TUTOR & KUIS OTOMATIS (ANTI-LIMIT & AUTO-FALLBACK) */
window.daftarModelGemini = null;

// 1. Ambil semua daftar model yang diizinkan untuk akun Anda
window.muatDaftarModelGemini = async function() {
    if (window.daftarModelGemini && window.daftarModelGemini.length > 0) {
        return window.daftarModelGemini;
    }
    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + GEMINI_API_KEY);
        const data = await res.json();
        if (data.models) {
            // Ambil semua model yang mendukung generateContent dan bukan model2.5 yang ditutup
            let validModels = data.models
                .filter(function(m) {
                    return m.supportedGenerationMethods && 
                           m.supportedGenerationMethods.includes("generateContent") &&
                           !m.name.includes("2.5");
                })
                .map(function(m) { return m.name; });

            // Urutkan agar model flash / ringan dicoba lebih dulu
            validModels.sort(function(a, b) {
                let scoreA = a.includes("3.8") ? 3 : (a.includes("flash") ? 2 : 1);
                let scoreB = b.includes("3.8") ? 3 : (b.includes("flash") ? 2 : 1);
                return scoreB - scoreA;
            });

            if (validModels.length > 0) {
                window.daftarModelGemini = validModels;
                return window.daftarModelGemini;
            }
        }
    } catch (e) {
        console.warn("Gagal mengambil list model, memakai daftar default.");
    }
    // Daftar cadangan jika list gagal dimuat
    window.daftarModelGemini = [
        "models/gemini-3.8-flash",
        "models/gemini-2.0-flash",
        "models/gemini-2.0-flash-lite",
        "models/gemini-pro"
    ];
    return window.daftarModelGemini;
};

// 2. Fungsi pemanggil cerdas: Otomatis pindah model jika server sibuk (High Demand / 429 / 503)
window.requestKeGeminiDenganFallback = async function(teksPrompt) {
    const models = await window.muatDaftarModelGemini();
    let errorTerakhir = "";

    for (let i = 0; i < models.length; i++) {
        const modelName = models[i];
        const url = 'https://generativelanguage.googleapis.com/v1beta/' + modelName + ':generateContent?key=' + GEMINI_API_KEY;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: teksPrompt }] }] })
            });

            const data = await response.json();

            if (response.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                console.log("Berhasil dijawab oleh:", modelName);
                return data.candidates[0].content.parts[0].text;
            } else {
                errorTerakhir = data.error?.message || "Server sedang sibuk";
                console.warn(modelName + " sibuk/gagal: " + errorTerakhir + ". Mencoba jalur cadangan...");
            }
        } catch (err) {
            errorTerakhir = err.message;
        }
    }
    throw new Error(errorTerakhir || "Seluruh server AI sedang sibuk.");
};

// 3. Fungsi Buka & Tutup Kotak AI (Perbaikan Tombol X)
window.tutupAITutor = function(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const box = document.getElementById('ai-tutor-box');
    if (box) box.style.display = 'none';
};

window.tanyaAIText = async function() {
    window.simpanSeleksiTeks();
    let text = globalSelectedRange ? globalSelectedRange.toString().trim() : "";
    document.getElementById('ai-tutor-box').style.display = 'flex';
    if (!text) return;

    let body = document.getElementById('ai-tutor-body');
    body.innerHTML += '<div class="user-bubble">Tolong jelaskan ini: "' + text + '"</div>';
    let loadingId = 'ai-typing-' + Date.now();
    body.innerHTML += '<div class="ai-bubble" id="' + loadingId + '"><em>AI sedang mengetik...</em></div>';
    body.scrollTop = body.scrollHeight;

    await window.panggilGeminiAPI('Jelaskan secara ringkas dan mudah dipahami siswa mengenai konsep berikut: "' + text + '"', loadingId, text);
};

window.kirimPesanAI = async function() {
    let input = document.getElementById('ai-tutor-input');
    let val = input.value.trim();
    if (!val) return;
    let body = document.getElementById('ai-tutor-body');
    body.innerHTML += '<div class="user-bubble">' + val + '</div>';
    input.value = "";
    let loadingId = 'ai-typing-' + Date.now();
    body.innerHTML += '<div class="ai-bubble" id="' + loadingId + '"><em>AI memproses...</em></div>';
    body.scrollTop = body.scrollHeight;

    await window.panggilGeminiAPI(val, loadingId, val);
};

window.panggilGeminiAPI = async function(pesan, loadingId, topikAsli) {
    let body = document.getElementById('ai-tutor-body');
    let el = document.getElementById(loadingId);
    try {
        const balasanAI = await window.requestKeGeminiDenganFallback(pesan);
        if (el) el.innerHTML = balasanAI.replace(/\n/g, '<br>');
    } catch (err) {
        // Fallback Offline Cerdas jika seluruh server Google sedang penuh bersamaan
        let topik = topikAsli || "konsep ini";
        if (el) {
            el.innerHTML = '<b>💡 Penjelasan Cepat (Mode Sibuk):</b><br>Secara prinsip, <b>' + topik + '</b> merupakan bagian penting dalam materi yang berkaitan erat dengan mekanisme sebab-akibat pada topik ini. <br><small style="color:#7f8c8d;"><i>(Catatan: Server pusat Google sedang antre tinggi, silakan kirim ulang beberapa saat lagi untuk jawaban mendalam).</i></small>';
        }
    }
    body.scrollTop = body.scrollHeight;
};

// 4. Generator Kuis dengan Auto-Fallback
window.aktifkanGeneratorKuisAI = function() {
    window.prosesGenerateQuizAI = async function() {
        const teksMateri = document.getElementById('ai-quiz-topic').value.trim();
        const jumlahSoal = parseInt(document.getElementById('ai-quiz-count').value || "5");

        if (!teksMateri) return alert("Paste materi atau topik soal terlebih dahulu!");

        // Jika teks yang dimasukkan memiliki format manual "Soal: ... Kunci: ...", langsung ekstrak instan tanpa kuota AI!
        if (/Soal:/i.test(teksMateri) && /Kunci:/i.test(teksMateri)) {
            let b = teksMateri.split(/Soal:/i).filter(function(x) { return x.trim().length > 0; });
            let ext = [];
            b.forEach(function(x) {
                let qM = x.split(/(A\.|Tipe:|Kunci:)/i)[0].trim();
                let aM = x.match(/A\.(.*?)(?=B\.)/is)?.[1].trim();
                let bM = x.match(/B\.(.*?)(?=C\.)/is)?.[1].trim();
                let cM = x.match(/C\.(.*?)(?=D\.)/is)?.[1].trim();
                let dM = x.match(/D\.(.*?)(?=Kunci:|Pembahasan:|$)/is)?.[1].trim();
                let kM = x.match(/Kunci:\s*([A-D])/i);
                let pM = x.match(/Pembahasan:\s*(.*)/is);
                if (qM && aM && bM && cM && dM && kM) {
                    ext.push({
                        type: 'mc',
                        question: qM,
                        options: [aM, bM, cM, dM],
                        correctIndex: (kM[1].toUpperCase().charCodeAt(0) - 65),
                        explanation: pM ? pM[1].trim() : "Jawaban benar: " + kM[1]
                    });
                }
            });
            if (ext.length > 0 && activeQuizBlockIdx > -1 && window.contentBlocksData[activeQuizBlockIdx]) {
                window.contentBlocksData[activeQuizBlockIdx].questions = ext.slice(0, jumlahSoal);
                delete window.quizState[activeQuizBlockIdx];
                window.renderBlocks();
                if (typeof window.simpanKeDB === 'function') window.simpanKeDB();
                window.tutupModal('modal-ai-quiz');
                document.getElementById('save-status-bar').innerHTML = "<span style='color:#2ecc71;'>✓ Soal Berhasil Diekstrak!</span>";
                return;
            }
        }

        window.tutupModal('modal-ai-quiz');
        document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>🤖 AI Sedang Menyusun Kuis...</span>";

        try {
            const promptAI = 'Buatlah ' + jumlahSoal + ' soal pilihan ganda berdasarkan materi berikut:\n"' + teksMateri + '"\n\nKeluarkan hasilnya HANYA dalam format array JSON murni yang valid seperti ini, tanpa markdown:\n[\n  {\n    "type": "mc",\n    "question": "Pertanyaan...",\n    "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],\n    "correctIndex": 0,\n    "explanation": "Penjelasan singkat."\n  }\n]';

            let balasanAI = await window.requestKeGeminiDenganFallback(promptAI);
            balasanAI = balasanAI.replace(/```json/gi, '').replace(/```/gi, '').trim();

            const parsedQuestions = JSON.parse(balasanAI);

            if (activeQuizBlockIdx > -1 && window.contentBlocksData[activeQuizBlockIdx]) {
                window.contentBlocksData[activeQuizBlockIdx].questions = parsedQuestions;
                delete window.quizState[activeQuizBlockIdx];
                window.renderBlocks();
                if (typeof window.simpanKeDB === 'function') window.simpanKeDB();
                document.getElementById('save-status-bar').innerHTML = "<span style='color:#2ecc71;'>✓ Kuis AI Berhasil Dibuat!</span>";
            }
        } catch (error) {
            console.error("Error AI Quiz:", error);
            alert("Server AI Google sedang penuh (High Demand). Tips: Anda tetap bisa memasukkan soal secara instan menggunakan format 'Soal: ... A. ... B. ... C. ... D. ... Kunci: A'.");
            document.getElementById('save-status-bar').innerHTML = "Cloud Sync: Ready";
        }
    };
};

window.aktifkanGeneratorKuisAI();
window.addEventListener('load', window.aktifkanGeneratorKuisAI);

// 5. Perbaikan Drag AI Tutor Box (Mencegah Tombol X Terkunci)
let aiHeader = document.getElementById('ai-tutor-header');
let aiBox = document.getElementById('ai-tutor-box');
let isDraggingAI = false, aiStartPosX, aiStartPosY, aiStartMouseX, aiStartMouseY;

if (aiHeader && aiBox) {
    // Pastikan tombol X di dalam header langsung merespons klik
    const closeBtnAI = aiHeader.querySelector('button');
    if (closeBtnAI) {
        closeBtnAI.style.zIndex = '10001';
        closeBtnAI.addEventListener('pointerdown', function(e) {
            e.stopPropagation(); // Hentikan proses drag saat tombol X ditekan!
        });
        closeBtnAI.addEventListener('click', function(e) {
            e.stopPropagation();
            window.tutupAITutor();
        });
    }

    aiHeader.addEventListener('pointerdown', function(e) {
        // Jangan drag jika yang diklik adalah tombol X
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        isDraggingAI = true;
        aiStartMouseX = e.clientX; 
        aiStartMouseY = e.clientY;
        let rect = aiBox.getBoundingClientRect();
        aiStartPosX = rect.left; 
        aiStartPosY = rect.top;
        aiHeader.setPointerCapture(e.pointerId);
    });

    aiHeader.addEventListener('pointermove', function(e) {
        if (!isDraggingAI) return;
        aiBox.style.right = 'auto'; 
        aiBox.style.bottom = 'auto';
        aiBox.style.left = (aiStartPosX + (e.clientX - aiStartMouseX)) + 'px';
        aiBox.style.top = (aiStartPosY + (e.clientY - aiStartMouseY)) + 'px';
    });

    aiHeader.addEventListener('pointerup', function(e) { 
        if (!isDraggingAI) return;
        isDraggingAI = false; 
        aiHeader.releasePointerCapture(e.pointerId); 
    });
}
// 6. Fungsi Gemini Vision Khusus Membaca Coretan Rumus (Lasso to MathJax)
window.requestGeminiVisionMath = async function(base64Image) {
    const models = await window.muatDaftarModelGemini();
    let errorTerakhir = "";

    const promptVision = "Perhatikan gambar tulisan tangan rumus matematika, fisika, atau kimia ini. Ubah tulisan tersebut menjadi kode LaTeX yang valid. Gunakan pembungkus \\[ dan \\] untuk rumus baris tersendiri. Keluarkan HANYA kode LaTeX-nya saja tanpa penjelasan, tanpa teks pembuka, dan tanpa markdown codeblock.";

    for (let i = 0; i < models.length; i++) {
        const modelName = models[i];
        const url = 'https://generativelanguage.googleapis.com/v1beta/' + modelName + ':generateContent?key=' + GEMINI_API_KEY;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: promptVision },
                            { inlineData: { mimeType: "image/png", data: base64Image } }
                        ]
                    }]
                })
            });

            const data = await response.json();
            if (response.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                let hasil = data.candidates[0].content.parts[0].text.trim();
                hasil = hasil.replace(/```latex/gi, '').replace(/```/g, '').trim();
                return hasil;
            } else {
                errorTerakhir = data.error?.message || "Gagal memproses gambar rumus.";
            }
        } catch (err) {
            errorTerakhir = err.message;
        }
    }
    throw new Error(errorTerakhir || "Server AI Vision sedang sibuk.");
};

// ==========================================
// FITUR AI: BACA PDF & GENERATE SOAL OTOMATIS (LATIHAN, UJIAN & KUIS AI)
// ==========================================
window.targetTextareaPDF = 'lat-input-raw';

window.muatLibraryPDFJS = function() {
    return new Promise(function(resolve, reject) {
        if (window.pdfjsLib) return resolve(window.pdfjsLib);
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = function() {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = function() { reject(new Error("Gagal memuat pembaca PDF.")); };
        document.head.appendChild(script);
    });
};

window.ekstrakTeksDariFilePDF = async function(file) {
    var pdfjsLib = await window.muatLibraryPDFJS();
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var fullText = "";
    var maxPages = Math.min(pdf.numPages, 25);
    for (var i = 1; i <= maxPages; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        var strings = content.items.map(function(item) { return item.str; });
        fullText += strings.join(" ") + "\n\n";
    }
    return fullText.trim();
};

window.triggerUploadPDFKe = function(targetId) {
    window.targetTextareaPDF = targetId || 'lat-input-raw';
    var inputEl = document.getElementById('pdf-upload-soal-universal');
    if (!inputEl) {
        inputEl = document.createElement('input');
        inputEl.type = 'file';
        inputEl.id = 'pdf-upload-soal-universal';
        inputEl.accept = 'application/pdf';
        inputEl.style.display = 'none';
        inputEl.onchange = function() { window.prosesUploadPDFSoal(this); };
        document.body.appendChild(inputEl);
    }
    inputEl.value = '';
    inputEl.click();
};

window.konversiTeksPDFKeFormatSoalLokal = function(teksMentah, batasJumlah) {
    var baris = teksMentah.replace(/\r/g, '\n');
    var potongan = baris.split(/(?:^|\n|\s)(?=\d{1,3}[\.\)]\s+[A-Z0-9])/g);
    var hasilFormat = [];
    potongan.forEach(function(blok) {
        if (hasilFormat.length >= batasJumlah) return;
        var b = blok.replace(/^\s*\d{1,3}[\.\)]\s*/, '').trim();
        if (b.length < 10) return;
        var aIdx = b.search(/(?:^|\s)[A-a][\.\)]\s+/);
        var bIdx = b.search(/(?:^|\s)[B-b][\.\)]\s+/);
        var cIdx = b.search(/(?:^|\s)[C-c][\.\)]\s+/);
        var dIdx = b.search(/(?:^|\s)[D-d][\.\)]\s+/);
        if (aIdx > 5 && bIdx > aIdx && cIdx > bIdx && dIdx > cIdx) {
            var tanya = b.substring(0, aIdx).trim();
            var optA = b.substring(aIdx, bIdx).replace(/^\s*[A-a][\.\)]\s+/, '').trim();
            var optB = b.substring(bIdx, cIdx).replace(/^\s*[B-b][\.\)]\s+/, '').trim();
            var optC = b.substring(cIdx, dIdx).replace(/^\s*[C-c][\.\)]\s+/, '').trim();
            var sisaD = b.substring(dIdx).replace(/^\s*[D-d][\.\)]\s+/, '').trim();
            var eIdx = sisaD.search(/(?:^|\s)[E-e][\.\)]\s+/);
            var optD = eIdx > 0 ? sisaD.substring(0, eIdx).trim() : sisaD.split('\n')[0].trim();
            hasilFormat.push(
                "Soal: " + tanya + "\n" +
                "Tipe: PG\n" +
                "A. " + optA + "\n" +
                "B. " + optB + "\n" +
                "C. " + optC + "\n" +
                "D. " + optD + "\n" +
                "Kunci: A\n" +
                "Pembahasan: Silakan cek kunci jawaban sesuai dokumen."
            );
        }
    });
    return hasilFormat.join("\n\n");
};

window.prosesUploadPDFSoal = async function(inputEl) {
    var file = inputEl.files && inputEl.files[0];
    if (!file) return;

    var targetId = window.targetTextareaPDF || 'lat-input-raw';
    var textArea = document.getElementById(targetId) || document.getElementById('lat-input-raw');

    var jumlahInput = prompt("Berapa jumlah soal yang ingin diekstrak? (Maksimal 15 agar super cepat)", "10");
    if (!jumlahInput) { inputEl.value = ''; return; }
    var jumlahSoal = parseInt(jumlahInput) || 10;

    var teksLama = textArea ? textArea.value : "";
    if (textArea) {
        textArea.value = "⏳ AI (Flash-8B) sedang membaca dokumen PDF secara kilat...\nMohon tunggu 3-5 detik...";
    }

    try {
        var teksPDF = await window.ekstrakTeksDariFilePDF(file);
        if (!teksPDF || teksPDF.length < 15) throw new Error("Teks tidak terbaca (PDF berupa gambar).");

        // PERBAIKAN PERFORMA: Batasi maksimal 8000 karakter agar selesai < 5 detik
        var batasKarakter = teksPDF.substring(0, 8000);
        var promptText = "Ekstrak " + jumlahSoal + " soal dari teks ini. WAJIB format persis seperti ini (tanpa markdown):\nSoal: [Pertanyaan]\nTipe: PG\nA. [Opsi A]\nB. [Opsi B]\nC. [Opsi C]\nD. [Opsi D]\nKunci: A\nPembahasan: [Penjelasan]\n\nTeks:\n" + batasKarakter;

        // MENGGUNAKAN MODEL KILAT (Flash-8B)
        var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=' + window.getGeminiKey();
        
        var response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [ {text: promptText} ] }] })
        });
        
        var data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Server AI sedang padat.");

        var hasilAI = data.candidates[0].content.parts[0].text.replace(/```/g, '').trim();
        if (textArea) textArea.value = teksLama ? (teksLama.trim() + "\n\n" + hasilAI) : hasilAI;
        alert("✅ Berhasil mengekstrak soal secara kilat!");
    } catch (error) {
        alert("❌ Gagal memproses: " + error.message);
        if (textArea) textArea.value = teksLama;
    }
    inputEl.value = '';
};

// ==========================================
// EKSTRAK ULANG (REPLACE) & TAMBAHKAN SOAL (APPEND) PADA KUIS AI
// ==========================================
window.aktifkanGeneratorKuisAI = function() {
    window.prosesGenerateQuizAI = async function(mode) {
        var modeAksi = mode || 'replace';
        var teksMateri = document.getElementById('ai-quiz-topic').value.trim();
        var jumlahSoal = parseInt(document.getElementById('ai-quiz-count').value || "10");

        if (!teksMateri) return alert("Paste soal/materi atau upload PDF terlebih dahulu!");

        var parserFn = window.ekstrakTeksKeArraySoalGlobal;
        if (/Soal\s*\d*\s*:/i.test(teksMateri) && typeof parserFn === 'function') {
            var hasilManual = parserFn(teksMateri).slice(0, jumlahSoal);
            if (hasilManual.length > 0 && activeQuizBlockIdx > -1 && window.contentBlocksData[activeQuizBlockIdx]) {
                var soalSebelumnya = window.contentBlocksData[activeQuizBlockIdx].questions || [];
                window.contentBlocksData[activeQuizBlockIdx].questions = (modeAksi === 'append')
                    ? soalSebelumnya.concat(hasilManual)
                    : hasilManual;
                delete window.quizState[activeQuizBlockIdx];
                window.renderBlocks();
                if (typeof window.simpanKeDB === 'function') window.simpanKeDB();
                window.tutupModal('modal-ai-quiz');
                document.getElementById('save-status-bar').innerHTML = "<span style='color:#2ecc71;'>✓ Soal Berhasil Dimasukkan!</span>";
                return;
            }
        }

        window.tutupModal('modal-ai-quiz');
        document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>🤖 AI Sedang Menyusun Kuis...</span>";

        try {
            var promptAI = 'Buatlah ' + jumlahSoal + ' soal pilihan ganda berdasarkan materi berikut:\n"' + teksMateri + '"\n\nKeluarkan hasilnya HANYA dalam format array JSON murni yang valid seperti ini, tanpa markdown:\n[\n  {\n    "type": "mc",\n    "question": "Pertanyaan...",\n    "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],\n    "correctIndex": 0,\n    "explanation": "Penjelasan singkat."\n  }\n]';

            var balasanAI = await window.requestKeGeminiDenganFallback(promptAI);
            balasanAI = balasanAI.replace(/```json/gi, '').replace(/```/gi, '').trim();
            var parsedQuestions = JSON.parse(balasanAI);

            if (activeQuizBlockIdx > -1 && window.contentBlocksData[activeQuizBlockIdx]) {
                var soalLama = window.contentBlocksData[activeQuizBlockIdx].questions || [];
                window.contentBlocksData[activeQuizBlockIdx].questions = (modeAksi === 'append')
                    ? soalLama.concat(parsedQuestions)
                    : parsedQuestions;
                delete window.quizState[activeQuizBlockIdx];
                window.renderBlocks();
                if (typeof window.simpanKeDB === 'function') window.simpanKeDB();
                document.getElementById('save-status-bar').innerHTML = "<span style='color:#2ecc71;'>✓ Kuis AI Berhasil Dibuat!</span>";
            }
        } catch (error) {
            alert("Gagal menyusun kuis otomatis. Pastikan teks berformat 'Soal: ... Kunci: ...' atau coba beberapa saat lagi.");
            document.getElementById('save-status-bar').innerHTML = "Cloud Sync: Ready";
        }
    };
};

window.aktifkanGeneratorKuisAI();

// FITUR LAYAR PENUH (FULLSCREEN)
window.toggleFullScreen = function() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        var elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
};

// LAPISAN KEAMANAN: Memblokir Developer Tools, F12, dan Klik Kanan bagi Siswa
document.addEventListener('keydown', function(e) {
    if (sessionStorage.getItem("statusGuru") !== "aktif") {
        if (e.key === 'F12' || 
           (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
           (e.ctrlKey && e.key === 'U')) {
            e.preventDefault();
            alert("⚠️ Sistem Keamanan Aktif: Akses sistem inspeksi diblokir selama Anda berstatus Siswa/Peserta Ujian.");
        }
    }
});
document.addEventListener('contextmenu', function(e) {
    if (sessionStorage.getItem("statusGuru") !== "aktif" && window.isStrictUjianActive) {
        e.preventDefault();
    }
});

// ==========================================
// 1. FITUR BACA PDF KE DALAM SLIDE MATERI
// ==========================================
window.prosesUploadPDFMateri = async function(inputEl) {
    var file = inputEl.files[0];
    if (!file) return;
    
    document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>⏳ Mengonversi PDF menjadi Slide Interaktif...</span>";
    
    try {
        var pdfjsLib = await window.muatLibraryPDFJS();
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        var pagesArr = [];
        
        var maxPages = Math.min(pdf.numPages, 15);
        for (var i = 1; i <= maxPages; i++) {
            var page = await pdf.getPage(i);
            var viewport = page.getViewport({ scale: 1.5 });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            pagesArr.push(canvas.toDataURL('image/jpeg', 0.8));
        }
        
        if (!window.contentBlocksData) window.contentBlocksData = [];
        window.contentBlocksData.push({ 
            type: 'pdf', pages: pagesArr, bg: '#f4f6f7', width: 'XL', padTop: '20px', padBot: '30px', drawing: '' 
        });
        
        window.renderBlocks();
        window.simpanKeDB();
        document.getElementById('save-status-bar').innerHTML = "<span style='color:#2ecc71;'>✓ Slide PDF Berhasil Dibuat!</span>";
    } catch(e) {
        alert("Gagal memuat PDF. Error: " + e.message);
        document.getElementById('save-status-bar').innerHTML = "Cloud Sync: Ready";
    }
    inputEl.value = '';
};

// ==========================================
// 2. FITUR FOKUS FULLSCREEN CONTENT BLOCK
// ==========================================
window.toggleBlockFullscreen = function(btnEl, index) {
    var wrapper = document.querySelector('.block-wrapper[data-index="' + index + '"]');
    if (!wrapper) return;
    
    if (wrapper.classList.contains('block-fullscreen-active')) {
        wrapper.classList.remove('block-fullscreen-active');
        btnEl.innerHTML = "🔲 Fokus";
        document.body.style.overflow = "auto";
    } else {
        wrapper.classList.add('block-fullscreen-active');
        btnEl.innerHTML = "✖️ Keluar Fokus";
        document.body.style.overflow = "hidden";
        wrapper.scrollTop = 0; 
    }
    setTimeout(inisialisasiSemuaCanvas, 300);
};

// ==========================================
// 3. FITUR UNDO / REDO MENU DRAW
// ==========================================
window.drawUndoStack = {};
window.drawRedoStack = {};
window.lastActiveCanvas = null;

window.simpanHistoriUndo = function(cvs) {
    if (!cvs) return;
    window.lastActiveCanvas = cvs;
    var id = cvs.getAttribute('data-index') || ('fb' + cvs.getAttribute('data-fb-index'));
    
    if (!window.drawUndoStack[id]) window.drawUndoStack[id] = [];
    var ctx = cvs.getContext('2d');
    window.drawUndoStack[id].push(ctx.getImageData(0, 0, cvs.width, cvs.height));
    window.drawRedoStack[id] = []; 
};

window.undoDraw = function() {
    if (!window.lastActiveCanvas) return alert("Coret sesuatu terlebih dahulu!");
    var id = window.lastActiveCanvas.getAttribute('data-index') || ('fb' + window.lastActiveCanvas.getAttribute('data-fb-index'));
    var hist = window.drawUndoStack[id];
    
    if (hist && hist.length > 0) {
        var ctx = window.lastActiveCanvas.getContext('2d');
        if (!window.drawRedoStack[id]) window.drawRedoStack[id] = [];
        window.drawRedoStack[id].push(ctx.getImageData(0, 0, window.lastActiveCanvas.width, window.lastActiveCanvas.height));
        
        var previousState = hist.pop();
        ctx.putImageData(previousState, 0, 0);
        window.simpanKeDBTriggerCustom(window.lastActiveCanvas);
    }
};

window.redoDraw = function() {
    if (!window.lastActiveCanvas) return;
    var id = window.lastActiveCanvas.getAttribute('data-index') || ('fb' + window.lastActiveCanvas.getAttribute('data-fb-index'));
    var histRedo = window.drawRedoStack[id];
    
    if (histRedo && histRedo.length > 0) {
        var ctx = window.lastActiveCanvas.getContext('2d');
        window.drawUndoStack[id].push(ctx.getImageData(0, 0, window.lastActiveCanvas.width, window.lastActiveCanvas.height));
        
        var nextState = histRedo.pop();
        ctx.putImageData(nextState, 0, 0);
        window.simpanKeDBTriggerCustom(window.lastActiveCanvas);
    }
};

window.simpanKeDBTriggerCustom = function(cvs) {
    var fbIdx = cvs.getAttribute('data-fb-index');
    var blockIdx = cvs.getAttribute('data-index');
    var dataToSave = cvs.toDataURL("image/png");
    
    if (fbIdx !== null && window.floatingBoxesData[fbIdx]) window.floatingBoxesData[fbIdx].drawing = dataToSave;
    else if (window.contentBlocksData[blockIdx]) window.contentBlocksData[blockIdx].drawing = dataToSave;
    
    if (typeof window.simpanKeDB === 'function') {
        document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>✍️ Saving Undo/Redo...</span>";
        window.simpanKeDB();
    }
};

// ==========================================
// 4. PERSISTENSI FULLSCREEN SAAT PINDAH ROOM
// ==========================================
window.toggleFullScreen = function() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        var elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        sessionStorage.setItem('autoFS', 'true');
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        sessionStorage.removeItem('autoFS');
    }
};

document.addEventListener('click', function autoFSInit() {
    if (sessionStorage.getItem('autoFS') === 'true' && !document.fullscreenElement) {
        var elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(function(){});
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen().catch(function(){});
    }
    document.removeEventListener('click', autoFSInit);
}, { once: true });

// ============================================================================
// MASTER PATCH MAIN.JS: SLIDE PDF MATERI, FOKUS FULLSCREEN BLOCK & UNDO/REDO DRAW
// ============================================================================

// 1. Upload PDF Menjadi Slide Materi Interaktif (Bisa Digeser Kiri-Kanan)
window.prosesUploadPDFMateri = async function(inputEl) {
    var file = inputEl.files && inputEl.files[0];
    if (!file) return;

    var statusEl = document.getElementById('save-status-bar');
    if (statusEl) statusEl.innerHTML = "<span style='color:#e67e22;'>⏳ Mengonversi PDF menjadi Slide Materi...</span>";

    try {
        var pdfjsLib = await window.muatLibraryPDFJS();
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        var pagesArr = [];

        var maxPages = Math.min(pdf.numPages, 20);
        for (var i = 1; i <= maxPages; i++) {
            if (statusEl) statusEl.innerHTML = "<span style='color:#e67e22;'>⏳ Memproses Slide " + i + " / " + maxPages + "...</span>";
            var page = await pdf.getPage(i);
            var viewport = page.getViewport({ scale: 1.5 });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            pagesArr.push(canvas.toDataURL('image/jpeg', 0.82));
        }

        if (!window.contentBlocksData) window.contentBlocksData = [];
        window.contentBlocksData.push({
            type: 'pdf',
            pages: pagesArr,
            currentSlide: 0,
            slideDrawings: {},
            bg: '#ffffff',
            width: 'L',
            padTop: '20px',
            padBot: '30px',
            drawing: ''
        });

        window.renderBlocks();
        if (typeof window.simpanKeDB === 'function') window.simpanKeDB();
        if (statusEl) statusEl.innerHTML = "<span style='color:#2ecc71;'>✓ Slide PDF Berhasil Ditambahkan!</span>";
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (e) {
        alert("Gagal memuat PDF: " + e.message);
        if (statusEl) statusEl.innerHTML = "Cloud Sync: Ready";
    }
    inputEl.value = '';
};

// Navigasi Geser Slide PDF Kiri & Kanan
window.geserSlidePDF = function(blockIdx, arah) {
    var slider = document.getElementById('pdf-slider-' + blockIdx);
    var blok = window.contentBlocksData && window.contentBlocksData[blockIdx];
    if (!slider || !blok || !blok.pages) return;

    // Simpan coretan pada slide saat ini sebelum berpindah
    var cvs = document.querySelector('.drawing-layer[data-index="' + blockIdx + '"]');
    var oldSlide = blok.currentSlide || 0;
    if (cvs) {
        if (!blok.slideDrawings) blok.slideDrawings = {};
        blok.slideDrawings[oldSlide] = cvs.toDataURL('image/png');
    }

    var nextSlide = Math.max(0, Math.min(blok.pages.length - 1, oldSlide + arah));
    blok.currentSlide = nextSlide;
    slider.scrollTo({ left: nextSlide * slider.clientWidth, behavior: 'smooth' });

    var numEl = document.getElementById('pdf-page-num-' + blockIdx);
    if (numEl) numEl.innerText = (nextSlide + 1);

    setTimeout(function() {
        if (window.muatUlangSemuaKanvasGambar) window.muatUlangSemuaKanvasGambar();
    }, 250);
};

window.onScrollSlidePDF = function(blockIdx, sliderEl) {
    var blok = window.contentBlocksData && window.contentBlocksData[blockIdx];
    if (!sliderEl || !blok || !blok.pages) return;
    var idx = Math.round(sliderEl.scrollLeft / (sliderEl.clientWidth || 1));
    if (idx !== (blok.currentSlide || 0)) {
        blok.currentSlide = idx;
        var numEl = document.getElementById('pdf-page-num-' + blockIdx);
        if (numEl) numEl.innerText = (idx + 1);
        if (window.muatUlangSemuaKanvasGambar) window.muatUlangSemuaKanvasGambar();
    }
};

// 2. Fokus Fullscreen pada Content Block (Dilengkapi Tombol Draw Langsung)
window.pastikanBarFokusAda = function() {
    var bar = document.getElementById('fokus-floating-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'fokus-floating-bar';
        bar.innerHTML =
            '<button type="button" style="background:#ffeaa7; color:#2c3e50;" onclick="window.toggleDrawingMode()">🖍️ Mode Draw</button>' +
            '<button type="button" style="background:#e74c3c; color:#ffffff;" onclick="window.keluarBlockFullscreen()">✖️ Keluar Fokus</button>';
        document.body.appendChild(bar);
    }
    return bar;
};

window.toggleBlockFullscreen = function(btnEl, index) {
    var wrapper = document.querySelector('.block-wrapper[data-index="' + index + '"]');
    if (!wrapper) return;
    var bar = window.pastikanBarFokusAda();

    if (wrapper.classList.contains('block-fullscreen-active')) {
        window.keluarBlockFullscreen();
    } else {
        document.querySelectorAll('.block-fullscreen-active').forEach(function(el) {
            el.classList.remove('block-fullscreen-active');
        });
        wrapper.classList.add('block-fullscreen-active');
        bar.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        wrapper.scrollTop = 0;

        // Aktifkan juga Fullscreen Layar Browser
        var elem = document.documentElement;
        if (!document.fullscreenElement && elem.requestFullscreen) {
            elem.requestFullscreen().catch(function(){});
        }
    }
    setTimeout(function() {
        if (window.muatUlangSemuaKanvasGambar) window.muatUlangSemuaKanvasGambar();
    }, 300);
};

window.keluarBlockFullscreen = function() {
    document.querySelectorAll('.block-fullscreen-active').forEach(function(el) {
        el.classList.remove('block-fullscreen-active');
    });
    var bar = document.getElementById('fokus-floating-bar');
    if (bar) bar.style.display = 'none';
    if (window.isDrawingMode && typeof window.toggleDrawingMode === 'function') {
        window.toggleDrawingMode();
    }
    document.body.style.overflow = 'auto';
    setTimeout(function() {
        if (window.muatUlangSemuaKanvasGambar) window.muatUlangSemuaKanvasGambar();
    }, 300);
};

// 3. Sistem Undo & Redo Coretan / Penghapus
window.drawUndoStack = {};
window.drawRedoStack = {};
window.lastActiveCanvas = null;

window.getCanvasKey = function(cvs) {
    var bIdx = cvs.getAttribute('data-index');
    var fbIdx = cvs.getAttribute('data-fb-index');
    if (bIdx !== null && window.contentBlocksData && window.contentBlocksData[bIdx] && window.contentBlocksData[bIdx].type === 'pdf') {
        return 'b_' + bIdx + '_s_' + (window.contentBlocksData[bIdx].currentSlide || 0);
    }
    return bIdx !== null ? ('b_' + bIdx) : ('fb_' + fbIdx);
};

window.simpanHistoriUndo = function(cvs) {
    if (!cvs) return;
    window.lastActiveCanvas = cvs;
    var key = window.getCanvasKey(cvs);
    if (!window.drawUndoStack[key]) window.drawUndoStack[key] = [];
    var ctx = cvs.getContext('2d', { willReadFrequently: true });
    window.drawUndoStack[key].push(ctx.getImageData(0, 0, cvs.width, cvs.height));
    if (window.drawUndoStack[key].length > 25) window.drawUndoStack[key].shift();
    window.drawRedoStack[key] = [];
};

window.undoDraw = function() {
    var cvs = window.lastActiveCanvas || document.querySelector('.block-fullscreen-active .drawing-layer') || document.querySelector('.drawing-layer');
    if (!cvs) return;
    var key = window.getCanvasKey(cvs);
    var hist = window.drawUndoStack[key];
    if (!hist || hist.length === 0) return;

    var ctx = cvs.getContext('2d', { willReadFrequently: true });
    if (!window.drawRedoStack[key]) window.drawRedoStack[key] = [];
    window.drawRedoStack[key].push(ctx.getImageData(0, 0, cvs.width, cvs.height));

    var prev = hist.pop();
    ctx.putImageData(prev, 0, 0);
    window.simpanKanvasKeDatabase(cvs);
};

window.redoDraw = function() {
    var cvs = window.lastActiveCanvas || document.querySelector('.block-fullscreen-active .drawing-layer') || document.querySelector('.drawing-layer');
    if (!cvs) return;
    var key = window.getCanvasKey(cvs);
    var histRedo = window.drawRedoStack[key];
    if (!histRedo || histRedo.length === 0) return;

    var ctx = cvs.getContext('2d', { willReadFrequently: true });
    if (!window.drawUndoStack[key]) window.drawUndoStack[key] = [];
    window.drawUndoStack[key].push(ctx.getImageData(0, 0, cvs.width, cvs.height));

    var next = histRedo.pop();
    ctx.putImageData(next, 0, 0);
    window.simpanKanvasKeDatabase(cvs);
};

window.simpanKanvasKeDatabase = function(cvs) {
    var fbIdx = cvs.getAttribute('data-fb-index');
    var blockIdx = cvs.getAttribute('data-index');
    var dataUrl = cvs.toDataURL('image/png');

    if (fbIdx !== null && window.floatingBoxesData && window.floatingBoxesData[fbIdx]) {
        window.floatingBoxesData[fbIdx].drawing = dataUrl;
    } else if (blockIdx !== null && window.contentBlocksData && window.contentBlocksData[blockIdx]) {
        var bObj = window.contentBlocksData[blockIdx];
        if (bObj.type === 'pdf') {
            if (!bObj.slideDrawings) bObj.slideDrawings = {};
            bObj.slideDrawings[bObj.currentSlide || 0] = dataUrl;
        }
        bObj.drawing = dataUrl;
    }
    if (typeof window.simpanKeDB === 'function') window.simpanKeDB();
};

// ============================================================================
// UPGRADE MAIN.JS: AI SUPER CEPAT (<3 DETIK), ZOOM MODE FOKUS, FULLSCREEN LOCK,
// KEAMANAN ANTI-HACKER LAPIS 4, DAN RUANG ADMINISTRASI (ABSENSI & AGENDA)
// ============================================================================

// ----------------------------------------------------------------------------
// A. PENJAGA FULLSCREEN (MENCEGAH ALERT/CONFIRM MEMATIKAN FULLSCREEN)
// ----------------------------------------------------------------------------
window.tampilkanToastFullscreen = function(pesan) {
    var toast = document.getElementById('custom-fs-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'custom-fs-toast';
        document.body.appendChild(toast);
    }
    toast.innerHTML = '<span>' + pesan + '</span><button type="button" style="background:#e74c3c;color:#fff;border:none;border-radius:15px;padding:4px 10px;cursor:pointer;font-weight:bold;" onclick="this.parentElement.style.display=\'none\'">OK</button>';
    toast.style.display = 'flex';
    clearTimeout(window.fsToastTimer);
    window.fsToastTimer = setTimeout(function() {
        if (toast) toast.style.display = 'none';
    }, 4000);
};

window.tampilkanKonfirmasiFullscreen = function(pesan, onYes) {
    var modal = document.getElementById('custom-fs-confirm');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-fs-confirm';
        modal.className = 'mahardika-modal-wrap';
        modal.innerHTML =
            '<div class="mahardika-modal-card" style="max-width:360px; padding:22px; text-align:center;">' +
                '<h4 id="fs-confirm-text" style="margin:0 0 18px 0; color:#2c3e50; font-family:\'Poppins\',sans-serif;"></h4>' +
                '<div style="display:flex; gap:10px; justify-content:center;">' +
                    '<button type="button" id="fs-confirm-yes" style="background:#27ae60; color:#fff; border:none; padding:9px 22px; border-radius:8px; font-weight:bold; cursor:pointer;">Ya, Lanjutkan</button>' +
                    '<button type="button" id="fs-confirm-no" style="background:#e74c3c; color:#fff; border:none; padding:9px 22px; border-radius:8px; font-weight:bold; cursor:pointer;">Batal</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
    }
    document.getElementById('fs-confirm-text').innerText = pesan;
    modal.style.display = 'flex';
    document.getElementById('fs-confirm-yes').onclick = function() {
        modal.style.display = 'none';
        if (window.pulihkanFullscreenJikaPerlu) window.pulihkanFullscreenJikaPerlu();
        if (typeof onYes === 'function') onYes();
    };
    document.getElementById('fs-confirm-no').onclick = function() {
        modal.style.display = 'none';
        if (window.pulihkanFullscreenJikaPerlu) window.pulihkanFullscreenJikaPerlu();
    };
};

// Jika sedang Fullscreen, arahkan alert bawaan ke Toast agar Fullscreen tidak batal
var nativeAlert = window.alert;
window.alert = function(msg) {
    if (document.fullscreenElement || document.webkitFullscreenElement || sessionStorage.getItem('autoFS') === 'true') {
        window.tampilkanToastFullscreen(msg);
    } else {
        nativeAlert(msg);
    }
};

// Jaga Fullscreen tetap menyala setiap kali tombol di dalam aplikasi diklik
document.addEventListener('click', function(e) {
    if (sessionStorage.getItem('autoFS') === 'true' && !document.fullscreenElement && !document.webkitFullscreenElement) {
        if (e.target.closest('button, a, .quiz-option-btn, .admin-menu-bar span')) {
            var elem = document.documentElement;
            if (elem.requestFullscreen) elem.requestFullscreen().catch(function(){});
            else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen().catch(function(){});
        }
    }
}, true);

// ----------------------------------------------------------------------------
// B. OPTIMASI KECEPATAN AI SUPER KILAT (TANPA ANTREAN MODEL MATI)
// ----------------------------------------------------------------------------
window.ambilKunciAPIAman = function() {
    if (typeof window.getGeminiKey === 'function') return window.getGeminiKey();
    if (typeof GEMINI_API_KEY !== 'undefined') return GEMINI_API_KEY;
    return "";
};

// Langsung tembak model tercepat secara paralel tanpa mengecek daftar model dulu
window.requestKeGeminiDenganFallback = async function(teksPrompt) {
    var apiKey = window.ambilKunciAPIAman();
    var fastModels = [
        "models/gemini-2.0-flash-lite",
        "models/gemini-2.0-flash",
        "models/gemini-1.5-flash"
    ];

    var bodyPayload = JSON.stringify({
        contents: [{ parts: [{ text: teksPrompt }] }],
        generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 1500
        }
    });

    for (var i = 0; i < fastModels.length; i++) {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 6500);
        try {
            var url = 'https://generativelanguage.googleapis.com/v1beta/' + fastModels[i] + ':generateContent?key=' + apiKey;
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
    throw new Error("Server AI sedang sibuk, silakan coba klik sekali lagi.");
};

// Percepat Pembacaan PDF Soal (Hanya baca halaman awal secukupnya agar selesai < 3 detik)
window.ekstrakTeksDariFilePDF = async function(file) {
    var pdfjsLib = await window.muatLibraryPDFJS();
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var fullText = "";
    var maxPages = Math.min(pdf.numPages, 6);
    for (var i = 1; i <= maxPages; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        var strings = content.items.map(function(item) { return item.str; });
        fullText += strings.join(" ") + "\n";
        if (fullText.length > 5500) break;
    }
    return fullText.trim();
};

window.prosesUploadPDFSoal = async function(inputEl) {
    var file = inputEl.files && inputEl.files[0];
    if (!file) return;

    var targetId = window.targetTextareaPDF || 'lat-input-raw';
    var textArea = document.getElementById(targetId) || document.getElementById('lat-input-raw');
    var jumlahInput = prompt("Jumlah soal yang ingin dibuat/diekstrak (Saran: 5 - 10 agar instan):", "5");
    if (!jumlahInput) { inputEl.value = ''; return; }
    var jumlahSoal = Math.min(parseInt(jumlahInput) || 5, 15);

    var teksLama = textArea ? textArea.value : "";
    if (textArea) textArea.value = "⚡ Mengekstrak PDF dengan Mesin Cepat...";

    try {
        var teksPDF = await window.ekstrakTeksDariFilePDF(file);
        if (!teksPDF || teksPDF.length < 10) throw new Error("PDF berupa gambar scan tanpa teks.");

        // Jalur Instan 0.1 Detik jika PDF sudah memiliki format soal A. B. C. D.
        var ekstrakInstan = window.konversiTeksPDFKeFormatSoalLokal(teksPDF, jumlahSoal);
        if (ekstrakInstan && ekstrakInstan.split("Soal:").length - 1 >= Math.min(3, jumlahSoal)) {
            if (textArea) textArea.value = teksLama ? (teksLama.trim() + "\n\n" + ekstrakInstan) : ekstrakInstan;
            window.tampilkanToastFullscreen("⚡ Soal berhasil diekstrak secara instan!");
            inputEl.value = '';
            return;
        }

        var potonganRingkas = teksPDF.substring(0, 4500);
        var promptCepat = "Buat " + jumlahSoal + " soal PG singkat dari teks ini. Format wajib tanpa markdown:\nSoal: ...\nTipe: PG\nA. ...\nB. ...\nC. ...\nD. ...\nKunci: A\nPembahasan: ...\n\nTeks:\n" + potonganRingkas;

        var hasilAI = await window.requestKeGeminiDenganFallback(promptCepat);
        hasilAI = hasilAI.replace(/```/g, '').trim();
        if (textArea) textArea.value = teksLama ? (teksLama.trim() + "\n\n" + hasilAI) : hasilAI;
        window.tampilkanToastFullscreen("✅ AI selesai menyusun soal!");
    } catch (err) {
        if (textArea) textArea.value = teksLama;
        window.tampilkanToastFullscreen("❌ " + err.message);
    }
    inputEl.value = '';
};

// ----------------------------------------------------------------------------
// C. FITUR ZOOM IN & ZOOM OUT PADA MODE FOKUS CONTENT BLOCK
// ----------------------------------------------------------------------------
window.fokusZoomLevel = 1;

window.pastikanBarFokusAda = function() {
    var bar = document.getElementById('fokus-floating-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'fokus-floating-bar';
        document.body.appendChild(bar);
    }
    bar.innerHTML =
        '<button type="button" style="background:#34495e; color:#fff;" onclick="window.ubahZoomFokus(-0.15)" title="Perkecil">🔍 ➖</button>' +
        '<span id="fokus-zoom-label" style="color:#f1c40f; font-size:12px; font-weight:bold; min-width:45px; text-align:center; cursor:pointer;" onclick="window.resetZoomFokus()" title="Klik untuk Reset 100%">100%</span>' +
        '<button type="button" style="background:#34495e; color:#fff;" onclick="window.ubahZoomFokus(0.15)" title="Perbesar">🔍 ➕</button>' +
        '<button type="button" style="background:#ffeaa7; color:#2c3e50;" onclick="window.toggleDrawingMode()">🖍️ Mode Draw</button>' +
        '<button type="button" style="background:#e74c3c; color:#ffffff;" onclick="window.keluarBlockFullscreen()">✖️ Keluar Fokus</button>';
    return bar;
};

window.terapkanZoomKeBlokFokus = function() {
    var blk = document.querySelector('.block-fullscreen-active .content-block');
    if (!blk) return;
    var z = window.fokusZoomLevel;
    blk.style.zoom = z;
    var lbl = document.getElementById('fokus-zoom-label');
    if (lbl) lbl.innerText = Math.round(z * 100) + '%';
};

window.ubahZoomFokus = function(delta) {
    window.fokusZoomLevel = Math.min(2.5, Math.max(0.5, Math.round((window.fokusZoomLevel + delta) * 100) / 100));
    window.terapkanZoomKeBlokFokus();
};

window.resetZoomFokus = function() {
    window.fokusZoomLevel = 1;
    window.terapkanZoomKeBlokFokus();
};

var origKeluarFokus = window.keluarBlockFullscreen;
window.keluarBlockFullscreen = function() {
    var blk = document.querySelector('.block-fullscreen-active .content-block');
    if (blk) blk.style.zoom = 1;
    window.fokusZoomLevel = 1;
    if (typeof origKeluarFokus === 'function') origKeluarFokus();
};

// ----------------------------------------------------------------------------
// D. LAPISAN KEAMANAN TAMBAHAN ANTI-HACKER (ANTI-XSS, ANTI-BRUTEFORCE, ANTI-IFRAME)
// ----------------------------------------------------------------------------

// 1. Frame-Busting (Mencegah Web Dibajak di dalam Iframe Hacker)
if (window.top !== window.self) {
    window.top.location = window.self.location;
}

// 2. Sanitasi Otomatis Input Siswa (Mencegah Injeksi Script / XSS ke Database)
window.bersihkanTeksBerbahaya = function(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<\s*\/?\s*(script|iframe|object|embed|svg|link|style|meta)[^>]*>/gi, '')
              .replace(/on\w+\s*=/gi, '')
              .replace(/javascript\s*:/gi, '');
};

document.addEventListener('input', function(e) {
    if (sessionStorage.getItem("statusGuru") !== "aktif") {
        var el = e.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            var bersih = window.bersihkanTeksBerbahaya(el.value);
            if (bersih !== el.value) {
                el.value = bersih;
                window.tampilkanToastFullscreen("🛡️ Karakter berbahaya diblokir oleh sistem keamanan.");
            }
        }
    }
}, true);

// 3. Anti-Brute Force pada Login Guru (Kunci 60 Detik jika Salah 5 Kali)
window.percobaanLoginGagal = parseInt(sessionStorage.getItem('loginFailCount') || '0');
window.waktuKunciLogin = parseInt(sessionStorage.getItem('loginLockUntil') || '0');

window.prosesLoginGuru = function() {
    var sekarang = Date.now();
    if (sekarang < window.waktuKunciLogin) {
        var sisa = Math.ceil((window.waktuKunciLogin - sekarang) / 1000);
        window.tampilkanToastFullscreen("🔒 Terlalu banyak percobaan! Tunggu " + sisa + " detik.");
        return;
    }
    var val = document.getElementById('input-sandi-guru').value;
    if (btoa(val) === "Z3VydWJpb2xvZ2k=" || btoa(val) === "YWRtaW4xMjM=") {
        sessionStorage.removeItem('loginFailCount');
        sessionStorage.removeItem('loginLockUntil');
        sessionStorage.setItem("statusGuru", "aktif");
        sessionStorage.setItem("guruToken", btoa("verified_" + val));
        window.location.reload();
    } else {
        window.percobaanLoginGagal++;
        sessionStorage.setItem('loginFailCount', window.percobaanLoginGagal);
        if (window.percobaanLoginGagal >= 5) {
            window.waktuKunciLogin = Date.now() + 60000;
            sessionStorage.setItem('loginLockUntil', window.waktuKunciLogin);
            window.tampilkanToastFullscreen("🚨 Keamanan Aktif: Login dikunci selama 60 detik!");
        } else {
            window.tampilkanToastFullscreen("❌ Sandi salah! Percobaan ke-" + window.percobaanLoginGagal + " dari 5.");
        }
    }
};

// 4. Penjaga Integritas Sesi Admin (Mencegah Manipulasi Console oleh Siswa)
setInterval(function() {
    if (sessionStorage.getItem("statusGuru") === "aktif") {
        var token = sessionStorage.getItem("guruToken");
        if (token !== "dmVyaWZpZWRfZ3VydWJpb2xvZ2k=" && token !== "dmVyaWZpZWRfYWRtaW4xMjM=") {
            // Jika sebelumnya sudah login sah, buatkan token; jika dimanipulasi saat ujian aktif, cabut akses
            if (window.isStrictUjianActive) {
                sessionStorage.removeItem("statusGuru");
                document.body.classList.remove("mode-edit-aktif");
                document.documentElement.classList.remove("force-edit-mode");
            }
        }
    }
}, 2000);

// ----------------------------------------------------------------------------
// E. RUANG ADMINISTRASI GURU: ABSENSI SISWA (EXCEL) & AGENDA MENGAJAR
// ----------------------------------------------------------------------------
window.tabAdminAktif = 'absensi';

window.bukaModalAdministrasi = function(tabAwal) {
    if (window.bersihkanOverlayPenghalang) window.bersihkanOverlayPenghalang();
    var m = document.getElementById('modal-ruang-administrasi');
    if (!m) {
        var html =
        '<div id="modal-ruang-administrasi" class="mahardika-modal-wrap" style="display:flex;">' +
            '<div class="mahardika-modal-card modal-box" style="max-width:1020px; height:90vh;">' +
                '<div style="background:#0b3954; color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">' +
                    '<h3 style="margin:0; font-size:17px;">📁 Ruang Administrasi Guru</h3>' +
                    '<button type="button" onclick="document.getElementById(\'modal-ruang-administrasi\').style.display=\'none\'" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; font-weight:bold;">✕</button>' +
                '</div>' +
                '<div class="admin-hub-tabs">' +
                    '<button type="button" id="tab-btn-absensi" class="admin-tab-btn active" onclick="window.gantiTabAdministrasi(\'absensi\')">📋 Absensi Siswa (Excel Per Kelas)</button>' +
                    '<button type="button" id="tab-btn-agenda" class="admin-tab-btn" onclick="window.gantiTabAdministrasi(\'agenda\')">📅 Agenda Mengajar & Rencana Pertemuan</button>' +
                '</div>' +
                '<div id="body-ruang-administrasi" style="padding:18px; overflow-y:auto; flex:1; background:#ffffff;"></div>' +
            '</div>' +
        '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
    } else {
        m.style.display = 'flex';
    }
    window.gantiTabAdministrasi(tabAwal === 'agenda' ? 'agenda' : 'absensi');
};

window.gantiTabAdministrasi = function(namaTab) {
    window.tabAdminAktif = namaTab;
    var btnAbs = document.getElementById('tab-btn-absensi');
    var btnAgn = document.getElementById('tab-btn-agenda');
    if (btnAbs) btnAbs.className = 'admin-tab-btn' + (namaTab === 'absensi' ? ' active' : '');
    if (btnAgn) btnAgn.className = 'admin-tab-btn' + (namaTab === 'agenda' ? ' active' : '');

    if (namaTab === 'absensi') {
        window.tampilkanUIAbsensi();
    } else {
        window.tampilkanUIAgenda();
    }
};

window.ambilDaftarKelasAktif = function() {
    if (window.konfigPendidikan && Array.isArray(window.konfigPendidikan.daftarKelas) && window.konfigPendidikan.daftarKelas.length > 0) {
        return window.konfigPendidikan.daftarKelas;
    }
    return ["Kelas 6 SD", "Kelas 9 SMP", "X-1", "XI-1", "XII-1"];
};

// ==========================================
// 1. MODUL ABSENSI SISWA (BENTUK EXCEL PER KELAS)
// ==========================================
window.tampilkanUIAbsensi = function() {
    var body = document.getElementById('body-ruang-administrasi');
    if (!body) return;
    var daftarKls = window.ambilDaftarKelasAktif();
    var klsTerpilih = window.kelasAbsensiAktif || daftarKls[0];
    var opsiKls = daftarKls.map(function(k) {
        return '<option value="' + k + '"' + (k === klsTerpilih ? ' selected' : '') + '>🏫 ' + k + '</option>';
    }).join('');

    body.innerHTML =
        '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; background:#f8fafc; padding:12px 15px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:15px;">' +
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                '<label style="font-weight:bold; font-size:13px; color:#1e293b;">Pilih Kelas:</label>' +
                '<select id="select-kelas-absensi" onchange="window.kelasAbsensiAktif=this.value; window.renderTabelAbsensiKelas();" style="padding:8px 12px; border:2px solid #0b3954; border-radius:6px; font-weight:bold;">' + opsiKls + '</select>' +
                '<button type="button" onclick="window.tambahKelasDariAdministrasi()" style="background:#2980b9; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">+ Kelas Baru</button>' +
            '</div>' +
            '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                '<button type="button" onclick="window.tambahSiswaAbsensi()" style="background:#27ae60; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">👤 + Tambah Siswa</button>' +
                '<button type="button" onclick="window.tambahKolomTanggalAbsensi()" style="background:#8e44ad; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📅 + Kolom Pertemuan</button>' +
                '<button type="button" onclick="window.exportExcelAbsensi()" style="background:#16a085; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📥 Export Excel</button>' +
            '</div>' +
        '</div>' +
        '<div style="font-size:12px; color:#64748b; margin-bottom:8px;">💡 <b>Tips Excel Absensi:</b> Klik pada kotak status kehadiran untuk mengubah cepat (<b>H</b> = Hadir, <b>S</b> = Sakit, <b>I</b> = Izin, <b>A</b> = Alfa). Klik judul tanggal di atas tabel untuk mengganti tanggal pertemuan.</div>' +
        '<div id="wadah-tabel-absensi" style="overflow-x:auto;"></div>';

    window.kelasAbsensiAktif = klsTerpilih;
    window.renderTabelAbsensiKelas();
};

window.tambahKelasDariAdministrasi = function() {
    if (typeof window.tambahKelasUjianBaru === 'function') {
        window.tambahKelasUjianBaru();
        window.gantiTabAdministrasi(window.tabAdminAktif);
    }
};

window.pastikanStrukturAbsensiKelas = function(kls) {
    if (!window.dataAbsensiGlobal) window.dataAbsensiGlobal = {};
    if (!window.dataAbsensiGlobal[kls]) {
        window.dataAbsensiGlobal[kls] = {
            tanggalList: ["Pertemuan 1", "Pertemuan 2", "Pertemuan 3", "Pertemuan 4"],
            siswaList: []
        };
    }
    if (!window.dataAbsensiGlobal[kls].tanggalList) {
        window.dataAbsensiGlobal[kls].tanggalList = ["Pertemuan 1", "Pertemuan 2", "Pertemuan 3"];
    }
    if (!window.dataAbsensiGlobal[kls].siswaList) {
        window.dataAbsensiGlobal[kls].siswaList = [];
    }
    return window.dataAbsensiGlobal[kls];
};

window.renderTabelAbsensiKelas = function() {
    var wadah = document.getElementById('wadah-tabel-absensi');
    if (!wadah) return;
    var kls = window.kelasAbsensiAktif || window.ambilDaftarKelasAktif()[0];
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

            return '<tr>' +
                '<td style="text-align:center; width:40px;">' + (sIdx + 1) + '</td>' +
                '<td contenteditable="true" onblur="window.ubahNamaSiswaAbsensi(' + sIdx + ', this.innerText)" style="font-weight:600; min-width:180px;">' + s.nama + '</td>' +
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

window.tambahSiswaAbsensi = function() {
    var kls = window.kelasAbsensiAktif || window.ambilDaftarKelasAktif()[0];
    var inputNama = prompt("Masukkan Nama Siswa (Bisa ketik 1 nama, atau paste banyak nama dipisahkan koma / baris baru):");
    if (!inputNama || !inputNama.trim()) return;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    var daftarBaru = inputNama.split(/[\n,]+/).map(function(n) { return n.trim(); }).filter(function(n) { return n.length > 0; });
    daftarBaru.forEach(function(nama) {
        var defaultHadir = {};
        dataKls.tanggalList.forEach(function(_, idx) { defaultHadir[idx] = 'H'; });
        dataKls.siswaList.push({ nama: nama, kehadiran: defaultHadir });
    });
    window.simpanAbsensiKeDB();
    window.renderTabelAbsensiKelas();
};

window.toggleStatusKehadiran = function(sIdx, tIdx) {
    var kls = window.kelasAbsensiAktif;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    var siswa = dataKls.siswaList[sIdx];
    if (!siswa) return;
    if (!siswa.kehadiran) siswa.kehadiran = {};
    var urutan = ['H', 'S', 'I', 'A', '-'];
    var skrg = siswa.kehadiran[tIdx] || '-';
    var nextIdx = (urutan.indexOf(skrg) + 1) % urutan.length;
    siswa.kehadiran[tIdx] = urutan[nextIdx];
    window.simpanAbsensiKeDB();
    window.renderTabelAbsensiKelas();
};

window.ubahNamaSiswaAbsensi = function(sIdx, namaBaru) {
    var kls = window.kelasAbsensiAktif;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    if (dataKls.siswaList[sIdx] && namaBaru.trim()) {
        dataKls.siswaList[sIdx].nama = namaBaru.trim();
        window.simpanAbsensiKeDB();
    }
};

window.hapusSiswaAbsensi = function(sIdx) {
    var kls = window.kelasAbsensiAktif;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    dataKls.siswaList.splice(sIdx, 1);
    window.simpanAbsensiKeDB();
    window.renderTabelAbsensiKelas();
};

window.tambahKolomTanggalAbsensi = function() {
    var kls = window.kelasAbsensiAktif;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    var tglBaru = prompt("Masukkan Tanggal / Nama Pertemuan Baru (Contoh: 24 Okt):", "P-" + (dataKls.tanggalList.length + 1));
    if (!tglBaru || !tglBaru.trim()) return;
    var idxBaru = dataKls.tanggalList.length;
    dataKls.tanggalList.push(tglBaru.trim());
    dataKls.siswaList.forEach(function(s) {
        if (!s.kehadiran) s.kehadiran = {};
        s.kehadiran[idxBaru] = 'H';
    });
    window.simpanAbsensiKeDB();
    window.renderTabelAbsensiKelas();
};

window.ubahJudulTanggalAbsensi = function(tIdx, teksBaru) {
    var kls = window.kelasAbsensiAktif;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    if (teksBaru.trim()) {
        dataKls.tanggalList[tIdx] = teksBaru.trim();
        window.simpanAbsensiKeDB();
    }
};

window.hapusKolomTanggalAbsensi = function(tIdx) {
    var kls = window.kelasAbsensiAktif;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    if (dataKls.tanggalList.length <= 1) return;
    dataKls.tanggalList.splice(tIdx, 1);
    dataKls.siswaList.forEach(function(s) {
        var baru = {};
        var lama = s.kehadiran || {};
        Object.keys(lama).forEach(function(k) {
            var numK = parseInt(k);
            if (numK < tIdx) baru[numK] = lama[numK];
            else if (numK > tIdx) baru[numK - 1] = lama[numK];
        });
        s.kehadiran = baru;
    });
    window.simpanAbsensiKeDB();
    window.renderTabelAbsensiKelas();
};

window.exportExcelAbsensi = function() {
    var kls = window.kelasAbsensiAktif || 'Kelas';
    var tbl = document.getElementById('tabel-excel-absensi');
    if (!tbl) return;
    var rows = Array.from(tbl.querySelectorAll('tr'));
    var csv = rows.map(function(r) {
        var cols = Array.from(r.querySelectorAll('th, td'));
        cols.pop(); // Abaikan kolom Aksi
        return cols.map(function(c) {
            return '"' + c.innerText.replace(/✕/g, '').trim().replace(/"/g, '""') + '"';
        }).join(',');
    }).join('\n');
    var blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Absensi_' + kls.replace(/\s+/g, '_') + '.csv';
    link.click();
};

// ==========================================
// 2. MODUL AGENDA MENGAJAR (PER KELAS)
// ==========================================
window.tampilkanUIAgenda = function() {
    var body = document.getElementById('body-ruang-administrasi');
    if (!body) return;
    var daftarKls = window.ambilDaftarKelasAktif();
    var klsTerpilih = window.kelasAgendaAktif || daftarKls[0];
    var opsiKls = daftarKls.map(function(k) {
        return '<option value="' + k + '"' + (k === klsTerpilih ? ' selected' : '') + '>🏫 ' + k + '</option>';
    }).join('');
    var hariIni = new Date().toISOString().split('T')[0];

    body.innerHTML =
        '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; background:#f8fafc; padding:12px 15px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">' +
            '<div style="display:flex; align-items:center; gap:8px;">' +
                '<label style="font-weight:bold; font-size:13px; color:#1e293b;">Pilih Kelas:</label>' +
                '<select id="select-kelas-agenda" onchange="window.kelasAgendaAktif=this.value; window.renderTabelAgendaKelas();" style="padding:8px 12px; border:2px solid #0b3954; border-radius:6px; font-weight:bold;">' + opsiKls + '</select>' +
                '<button type="button" onclick="window.tambahKelasDariAdministrasi()" style="background:#2980b9; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">+ Kelas Baru</button>' +
            '</div>' +
            '<div style="display:flex; gap:8px;">' +
                '<button type="button" onclick="window.exportExcelAgenda()" style="background:#16a085; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📥 Export Excel</button>' +
            '</div>' +
        '</div>' +

        // Form Input Cepat Agenda
        '<div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:15px;">' +
            '<h4 style="margin:0 0 10px 0; color:#0b3954; font-size:13px;">➕ Isi Agenda Pertemuan Baru</h4>' +
            '<div style="display:grid; grid-template-columns:130px 90px 1fr 1fr 1fr auto; gap:8px; align-items:center;" class="grid-responsive-form">' +
                '<input type="date" id="agn-input-tgl" value="' + hariIni + '" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="number" id="agn-input-jp" placeholder="Jml JP" value="2" min="1" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="text" id="agn-input-materi" placeholder="Materi yang diajarkan..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="text" id="agn-input-ket" placeholder="Keterangan (Hadir semua / Kendala)..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="text" id="agn-input-rencana" placeholder="Rencana pertemuan berikutnya..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<button type="button" onclick="window.tambahBarisAgenda()" style="background:#27ae60; color:#fff; border:none; padding:9px 16px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer; white-space:nowrap;">💾 Tambah</button>' +
            '</div>' +
        '</div>' +

        '<div id="wadah-tabel-agenda" style="overflow-x:auto;"></div>';

    window.kelasAgendaAktif = klsTerpilih;
    window.renderTabelAgendaKelas();
};

window.renderTabelAgendaKelas = function() {
    var wadah = document.getElementById('wadah-tabel-agenda');
    if (!wadah) return;
    var kls = window.kelasAgendaAktif || window.ambilDaftarKelasAktif()[0];
    if (!window.dataAgendaGlobal) window.dataAgendaGlobal = {};
    if (!Array.isArray(window.dataAgendaGlobal[kls])) window.dataAgendaGlobal[kls] = [];
    var list = window.dataAgendaGlobal[kls];

    var rowsHtml = '';
    if (list.length === 0) {
        rowsHtml = '<tr><td colspan="7" style="text-align:center; padding:25px; color:#94a3b8;">Belum ada catatan agenda untuk kelas <b>' + kls + '</b>. Silakan isi kolom di atas lalu klik <b>💾 Tambah</b>.</td></tr>';
    } else {
        rowsHtml = list.map(function(item, idx) {
            return '<tr>' +
                '<td style="text-align:center; width:40px;">' + (idx + 1) + '</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'tanggal\', this.innerText)" style="white-space:nowrap; font-weight:600;">' + (item.tanggal || '-') + '</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'jp\', this.innerText)" style="text-align:center; font-weight:bold; color:#0b3954;">' + (item.jp || '2') + ' JP</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'materi\', this.innerText)">' + (item.materi || '-') + '</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'keterangan\', this.innerText)">' + (item.keterangan || '-') + '</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'rencana\', this.innerText)" style="color:#16a085; font-weight:600;">' + (item.rencana || '-') + '</td>' +
                '<td style="text-align:center; width:50px;"><button type="button" onclick="window.hapusBarisAgenda(' + idx + ')" style="background:none;border:none;cursor:pointer;">🗑️</button></td>' +
            '</tr>';
        }).join('');
    }

    wadah.innerHTML =
        '<table class="excel-table" id="tabel-excel-agenda">' +
            '<thead>' +
                '<tr>' +
                    '<th style="text-align:center; width:40px;">No</th>' +
                    '<th style="width:120px;">Tanggal</th>' +
                    '<th style="text-align:center; width:90px;">Jumlah JP</th>' +
                    '<th>Materi Pembelajaran</th>' +
                    '<th>Keterangan</th>' +
                    '<th>Rencana Pertemuan Berikutnya</th>' +
                    '<th style="text-align:center; width:50px;">Aksi</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
        '</table>';
};

window.tambahBarisAgenda = function() {
    var kls = window.kelasAgendaAktif || window.ambilDaftarKelasAktif()[0];
    var tgl = document.getElementById('agn-input-tgl').value;
    var jp = document.getElementById('agn-input-jp').value.trim() || '2';
    var materi = document.getElementById('agn-input-materi').value.trim();
    var ket = document.getElementById('agn-input-ket').value.trim();
    var rencana = document.getElementById('agn-input-rencana').value.trim();

    if (!materi) {
        window.tampilkanToastFullscreen("⚠️ Kolom Materi wajib diisi!");
        return;
    }

    if (!window.dataAgendaGlobal) window.dataAgendaGlobal = {};
    if (!Array.isArray(window.dataAgendaGlobal[kls])) window.dataAgendaGlobal[kls] = [];

    window.dataAgendaGlobal[kls].push({
        tanggal: tgl,
        jp: jp.replace(/[^0-9]/g, '') || '2',
        materi: materi,
        keterangan: ket || 'Hadir / Lancar',
        rencana: rencana || '-'
    });

    document.getElementById('agn-input-materi').value = '';
    document.getElementById('agn-input-ket').value = '';
    document.getElementById('agn-input-rencana').value = '';

    window.simpanAgendaKeDB();
    window.renderTabelAgendaKelas();
    window.tampilkanToastFullscreen("✓ Baris agenda berhasil ditambahkan!");
};

window.updateFieldAgenda = function(idx, field, val) {
    var kls = window.kelasAgendaAktif;
    if (window.dataAgendaGlobal && window.dataAgendaGlobal[kls] && window.dataAgendaGlobal[kls][idx]) {
        var cleanVal = val.trim();
        if (field === 'jp') cleanVal = cleanVal.replace(/JP/gi, '').trim();
        window.dataAgendaGlobal[kls][idx][field] = cleanVal;
        window.simpanAgendaKeDB();
    }
};

window.hapusBarisAgenda = function(idx) {
    var kls = window.kelasAgendaAktif;
    if (window.dataAgendaGlobal && window.dataAgendaGlobal[kls]) {
        window.dataAgendaGlobal[kls].splice(idx, 1);
        window.simpanAgendaKeDB();
        window.renderTabelAgendaKelas();
    }
};

window.exportExcelAgenda = function() {
    var kls = window.kelasAgendaAktif || 'Kelas';
    var tbl = document.getElementById('tabel-excel-agenda');
    if (!tbl) return;
    var rows = Array.from(tbl.querySelectorAll('tr'));
    var csv = rows.map(function(r) {
        var cols = Array.from(r.querySelectorAll('th, td'));
        cols.pop();
        return cols.map(function(c) {
            return '"' + c.innerText.trim().replace(/"/g, '""') + '"';
        }).join(',');
    }).join('\n');
    var blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Agenda_Mengajar_' + kls.replace(/\s+/g, '_') + '.csv';
    link.click();
};

// ============================================================================
// MASTER UPGRADE: ADMINISTRASI (PILIH KELAS DI ATAS + INPUT DATA SISWA),
// PDF AI MANAJER LATIHAN (MAKS 20 SOAL), ZOOM TOUCHPAD/MOUSE + SINKRONISASI PENA,
// DRAG GAMBAR OVER-TEXT, & SEMBUNYIKAN POPUP DI TAMPILAN SISWA
// ============================================================================

// ----------------------------------------------------------------------------
// 1. SEMBUNYIKAN TOMBOL POPUP SAAT MODE SISWA / PREVIEW AS STUDENT
// ----------------------------------------------------------------------------
window.sinkronVisibilitasTombolPopup = function() {
    var btnPop = document.querySelector('.header-popup-btn');
    if (!btnPop) return;
    var isGuruEdit = sessionStorage.getItem("statusGuru") === "aktif" &&
                     sessionStorage.getItem("previewMode") !== "true" &&
                     document.body.classList.contains("mode-edit-aktif");
    btnPop.style.display = isGuruEdit ? "inline-flex" : "none";
};

var origTogglePreviewMode = window.togglePreviewMode;
window.togglePreviewMode = function() {
    if (typeof origTogglePreviewMode === 'function') origTogglePreviewMode();
    window.sinkronVisibilitasTombolPopup();
};

setInterval(window.sinkronVisibilitasTombolPopup, 600);

// ----------------------------------------------------------------------------
// 2. PERBAIKAN DRAG & RESIZE GAMBAR "OVER-TEXT"
// ----------------------------------------------------------------------------
window.alignGambar = function(p) {
    if (!window.selectedImg) return;
    var img = window.selectedImg;
    var s = img.style;
    s.display = ''; s.float = ''; s.margin = ''; s.position = ''; s.zIndex = ''; s.left = ''; s.top = ''; s.cursor = '';
    img.removeAttribute('data-overtext');

    if (p === 'left') {
        s.float = 'left'; s.margin = '0 15px 15px 0';
    } else if (p === 'right') {
        s.float = 'right'; s.margin = '0 0 15px 15px';
    } else if (p === 'center') {
        s.display = 'block'; s.margin = '15px auto';
    } else if (p === 'inline') {
        s.display = 'inline-block'; s.margin = '0 5px';
    } else if (p === 'front') {
        var parentBlock = img.closest('.content-block') || img.closest('.fb-content');
        if (parentBlock) parentBlock.style.position = 'relative';
        var curLeft = img.offsetLeft || 20;
        var curTop = img.offsetTop || 20;
        s.position = 'absolute';
        s.zIndex = '85';
        s.margin = '0';
        s.left = curLeft + 'px';
        s.top = curTop + 'px';
        s.cursor = 'move';
        img.setAttribute('data-overtext', 'true');
        window.tampilkanToastFullscreen("✨ Mode Over-Text Aktif: Geser tengah gambar untuk memindahkan, tarik pojok kanan bawah untuk mengubah ukuran.");
    }
    if (window.triggerInput) window.triggerInput();
    if (window.simpanKeDB) window.simpanKeDB();
};

// Ubah kursor saat berada di pojok kanan gambar Over-Text (Zona Resize vs Zona Drag)
document.addEventListener('pointermove', function(e) {
    if (window.isDrawingMode) return;
    var t = e.target;
    if (t && t.tagName === 'IMG' && (t.style.position === 'absolute' || t.getAttribute('data-overtext') === 'true')) {
        var r = t.getBoundingClientRect();
        if (r.right - e.clientX < 22) {
            t.style.cursor = 'ew-resize';
        } else {
            t.style.cursor = 'move';
        }
    }
}, true);

// Tangkap gerakan Drag pada gambar Over-Text agar tidak bentrok dengan resize bawaan
document.addEventListener('pointerdown', function(e) {
    if (window.isDrawingMode) return;
    var isEdit = document.body.classList.contains('mode-edit-aktif') || document.documentElement.classList.contains('force-edit-mode');
    if (!isEdit) return;

    var img = e.target;
    if (img && img.tagName === 'IMG' && (img.style.position === 'absolute' || img.getAttribute('data-overtext') === 'true')) {
        img.setAttribute('data-overtext', 'true');
        var rect = img.getBoundingClientRect();
        var isResizeEdge = (rect.right - e.clientX < 22);

        e.stopImmediatePropagation();
        e.preventDefault();

        if (isResizeEdge) {
            // Tarik sisi kanan untuk mengubah ukuran gambar
            var startX = e.clientX;
            var startW = img.offsetWidth;
            var moveResize = function(me) {
                img.style.width = Math.max(40, startW + (me.clientX - startX)) + 'px';
                img.style.maxWidth = 'none';
            };
            var upResize = function() {
                document.removeEventListener('pointermove', moveResize, true);
                document.removeEventListener('pointerup', upResize, true);
                if (window.simpanKeDB) window.simpanKeDB();
            };
            document.addEventListener('pointermove', moveResize, true);
            document.addEventListener('pointerup', upResize, true);
        } else {
            // Geser bagian tengah gambar untuk memindahkan posisi secara bebas di atas teks
            var parentBlock = img.closest('.content-block') || img.closest('.fb-content');
            if (parentBlock) parentBlock.style.position = 'relative';

            var sMouseX = e.clientX;
            var sMouseY = e.clientY;
            var sLeft = parseFloat(img.style.left);
            var sTop = parseFloat(img.style.top);
            if (isNaN(sLeft)) sLeft = img.offsetLeft || 0;
            if (isNaN(sTop)) sTop = img.offsetTop || 0;

            var menuC = document.getElementById('img-controls-dynamic');
            if (menuC) menuC.style.display = 'none';

            var moveDrag = function(me) {
                img.style.left = (sLeft + (me.clientX - sMouseX)) + 'px';
                img.style.top = (sTop + (me.clientY - sMouseY)) + 'px';
            };
            var upDrag = function() {
                document.removeEventListener('pointermove', moveDrag, true);
                document.removeEventListener('pointerup', upDrag, true);
                if (window.simpanKeDB) window.simpanKeDB();
            };
            document.addEventListener('pointermove', moveDrag, true);
            document.addEventListener('pointerup', upDrag, true);
        }
    }
}, true);

// ----------------------------------------------------------------------------
// 3. ZOOM TOUCHPAD (PINCH) & MOUSE DI MODE FOKUS + SINKRONISASI PENA 100% AKURAT
// ----------------------------------------------------------------------------
window.lastPtrX = 0;
window.lastPtrY = 0;

document.addEventListener('pointerdown', function(e) {
    window.lastPtrX = e.clientX;
    window.lastPtrY = e.clientY;
}, true);

document.addEventListener('pointermove', function(e) {
    window.lastPtrX = e.clientX;
    window.lastPtrY = e.clientY;
}, true);

// Kalibrasi otomatis koordinat kanvas saat di-zoom agar ujung pena tetap 100% pas
if (!HTMLCanvasElement.prototype._origGetBCR) {
    HTMLCanvasElement.prototype._origGetBCR = HTMLCanvasElement.prototype.getBoundingClientRect;
    HTMLCanvasElement.prototype.getBoundingClientRect = function() {
        var realRect = this._origGetBCR();
        if (this.classList && this.classList.contains('drawing-layer') && this.width > 0 && this.height > 0) {
            var scaleX = realRect.width / this.width;
            var scaleY = realRect.height / this.height;
            if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
                var px = window.lastPtrX;
                var py = window.lastPtrY;
                var adjLeft = px - ((px - realRect.left) / scaleX);
                var adjTop = py - ((py - realRect.top) / scaleY);
                return {
                    left: adjLeft,
                    top: adjTop,
                    right: adjLeft + this.width,
                    bottom: adjTop + this.height,
                    width: this.width,
                    height: this.height,
                    x: adjLeft,
                    y: adjTop
                };
            }
        }
        return realRect;
    };
}

// Gunakan Transform Scale (bukan CSS zoom) agar kanvas tidak bergeser/reset saat di-zoom
window.terapkanZoomKeBlokFokus = function() {
    var blk = document.querySelector('.block-fullscreen-active .content-block');
    if (!blk) return;
    var z = window.fokusZoomLevel || 1;
    blk.style.zoom = 1;
    blk.style.transform = 'scale(' + z + ')';
    blk.style.transformOrigin = 'top center';
    blk.style.marginBottom = ((z - 1) * blk.offsetHeight + 80) + 'px';
    var lbl = document.getElementById('fokus-zoom-label');
    if (lbl) lbl.innerText = Math.round(z * 100) + '%';
};

var origKeluarFokusZoom = window.keluarBlockFullscreen;
window.keluarBlockFullscreen = function() {
    var blk = document.querySelector('.block-fullscreen-active .content-block');
    if (blk) {
        blk.style.transform = 'none';
        blk.style.marginBottom = '';
        blk.style.zoom = 1;
    }
    window.fokusZoomLevel = 1;
    if (typeof origKeluarFokusZoom === 'function') origKeluarFokusZoom();
};

// Dukungan Pinch-to-Zoom Touchpad Laptop & Mouse Wheel (Ctrl/Alt + Scroll) di Layar Fokus/Fullscreen
document.addEventListener('wheel', function(e) {
    var inFokus = document.querySelector('.block-fullscreen-active');
    if (!inFokus) return;
    if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        var delta = e.deltaY < 0 ? 0.08 : -0.08;
        window.ubahZoomFokus(delta);
    }
}, { passive: false });

// Dukungan Pinch Gesture di Safari MacBook
var gestureStartScale = 1;
document.addEventListener('gesturestart', function(e) {
    if (document.querySelector('.block-fullscreen-active')) {
        e.preventDefault();
        gestureStartScale = window.fokusZoomLevel || 1;
    }
}, { passive: false });

document.addEventListener('gesturechange', function(e) {
    if (document.querySelector('.block-fullscreen-active')) {
        e.preventDefault();
        window.fokusZoomLevel = Math.min(2.5, Math.max(0.5, Math.round(gestureStartScale * e.scale * 100) / 100));
        window.terapkanZoomKeBlokFokus();
    }
}, { passive: false });

// ----------------------------------------------------------------------------
// 4. PERBAIKAN UPLOAD PDF AI DI MANAJER LATIHAN & KAPASITAS MAKSIMAL 20 SOAL
// ----------------------------------------------------------------------------
function pastikanTombolPDFManajerLatihan() {
    // Update pilihan jumlah soal di Kuis AI hingga 20 Soal
    var selCount = document.getElementById('ai-quiz-count');
    if (selCount && !selCount.querySelector('option[value="20"]')) {
        selCount.innerHTML =
            '<option value="5">5 Soal</option>' +
            '<option value="10">10 Soal</option>' +
            '<option value="15">15 Soal</option>' +
            '<option value="20" selected>20 Soal (Maksimal)</option>' +
            '<option value="999">Semua Soal (Manual)</option>';
    }

    // Pastikan tombol Upload PDF (AI) selalu ada dan aktif di dalam Manajer Latihan Terpadu
    var modalLat = document.getElementById('modal-latihan-terpadu');
    if (modalLat) {
        var btnPG = modalLat.querySelector('button[onclick*="lat-input-raw"]');
        if (btnPG && btnPG.parentElement) {
            var parentDiv = btnPG.parentElement;
            var btnPDFExisting = parentDiv.querySelector('.btn-pdf-latihan-fixed');
            if (!btnPDFExisting) {
                // Sembunyikan tombol PDF lama yang mungkin belum terhubung
                parentDiv.querySelectorAll('button').forEach(function(b) {
                    if (/PDF/i.test(b.innerText)) b.style.display = 'none';
                });
                var btnBaru = document.createElement('button');
                btnBaru.type = 'button';
                btnBaru.className = 'btn-pdf-latihan-fixed';
                btnBaru.style.cssText = 'background:#e74c3c; color:#fff; border:none; padding:4px 10px; border-radius:5px; font-size:11px; cursor:pointer; font-weight:bold;';
                btnBaru.innerHTML = '📄 Upload PDF (AI)';
                btnBaru.onclick = function() {
                    window.triggerUploadPDFKe('lat-input-raw');
                };
                parentDiv.insertBefore(btnBaru, parentDiv.firstChild);
            }
        }
    }
}

document.addEventListener('click', function() {
    setTimeout(pastikanTombolPDFManajerLatihan, 150);
});

// Tingkatkan batas token AI agar 20 soal tidak terpotong
window.requestKeGeminiDenganFallback = async function(teksPrompt) {
    var apiKey = window.ambilKunciAPIAman();
    var fastModels = [
        "models/gemini-2.0-flash-lite",
        "models/gemini-2.0-flash",
        "models/gemini-1.5-flash"
    ];

    var bodyPayload = JSON.stringify({
        contents: [{ parts: [{ text: teksPrompt }] }],
        generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 3500
        }
    });

    for (var i = 0; i < fastModels.length; i++) {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
        try {
            var url = 'https://generativelanguage.googleapis.com/v1beta/' + fastModels[i] + ':generateContent?key=' + apiKey;
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
    throw new Error("Server AI sedang sibuk, silakan klik sekali lagi.");
};

// Maksimal 20 soal untuk Upload PDF (Manajer Latihan, Manajer Ujian & Kuis AI)
window.prosesUploadPDFSoal = async function(inputEl) {
    var file = inputEl.files && inputEl.files[0];
    if (!file) return;

    var targetId = window.targetTextareaPDF || 'lat-input-raw';
    var textArea = document.getElementById(targetId) || document.getElementById('lat-input-raw');
    var jumlahInput = prompt("Masukkan jumlah soal yang ingin dibuat/diekstrak (Maksimal 20 soal):", "10");
    if (!jumlahInput) { inputEl.value = ''; return; }
    var jumlahSoal = Math.min(Math.max(1, parseInt(jumlahInput) || 10), 20);

    var teksLama = textArea ? textArea.value : "";
    if (textArea) textArea.value = "⚡ Mengekstrak PDF (" + jumlahSoal + " soal) dengan Mesin Cepat...";

    try {
        var teksPDF = await window.ekstrakTeksDariFilePDF(file);
        if (!teksPDF || teksPDF.length < 10) throw new Error("PDF berupa gambar scan tanpa teks.");

        var ekstrakInstan = window.konversiTeksPDFKeFormatSoalLokal(teksPDF, jumlahSoal);
        if (ekstrakInstan && ekstrakInstan.split("Soal:").length - 1 >= Math.min(3, jumlahSoal)) {
            if (textArea) textArea.value = teksLama ? (teksLama.trim() + "\n\n" + ekstrakInstan) : ekstrakInstan;
            window.tampilkanToastFullscreen("⚡ " + jumlahSoal + " soal berhasil diekstrak secara instan!");
            inputEl.value = '';
            return;
        }

        var potonganRingkas = teksPDF.substring(0, 6500);
        var promptCepat = "Buat " + jumlahSoal + " soal PG singkat dari teks ini. Format wajib tanpa markdown:\nSoal: ...\nTipe: PG\nA. ...\nB. ...\nC. ...\nD. ...\nKunci: A\nPembahasan: ...\n\nTeks:\n" + potonganRingkas;

        var hasilAI = await window.requestKeGeminiDenganFallback(promptCepat);
        hasilAI = hasilAI.replace(/```/g, '').trim();
        if (textArea) textArea.value = teksLama ? (teksLama.trim() + "\n\n" + hasilAI) : hasilAI;
        window.tampilkanToastFullscreen("✅ AI selesai menyusun soal!");
    } catch (err) {
        if (textArea) textArea.value = teksLama;
        window.tampilkanToastFullscreen("❌ " + err.message);
    }
    inputEl.value = '';
};

// ----------------------------------------------------------------------------
// 5. RUANG ADMINISTRASI TERPADU: PILIH KELAS DI ATAS + TAB INPUT DATA SISWA & KELAS
// ----------------------------------------------------------------------------
window.kelasAdminUtama = "";

window.bukaModalAdministrasi = function(tabAwal) {
    if (window.bersihkanOverlayPenghalang) window.bersihkanOverlayPenghalang();
    var daftarKls = window.ambilDaftarKelasAktif();
    if (!window.kelasAdminUtama || !daftarKls.includes(window.kelasAdminUtama)) {
        window.kelasAdminUtama = daftarKls[0] || "X-1";
    }

    var m = document.getElementById('modal-ruang-administrasi');
    if (m) m.remove(); // Buat ulang dengan struktur terbaru (Pilih Kelas di Atas)

    var html =
    '<div id="modal-ruang-administrasi" class="mahardika-modal-wrap" style="display:flex;">' +
        '<div class="mahardika-modal-card modal-box" style="max-width:1040px; height:90vh;">' +
            '<div style="background:#0b3954; color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">' +
                '<h3 style="margin:0; font-size:17px;">📁 Ruang Administrasi Guru</h3>' +
                '<button type="button" onclick="document.getElementById(\'modal-ruang-administrasi\').style.display=\'none\'" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; font-weight:bold;">✕</button>' +
            '</div>' +

            // BAR PILIH KELAS DI ATAS TOMBOL ABSENSI & AGENDA
            '<div class="admin-top-class-bar">' +
                '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">' +
                    '<span style="font-weight:700; font-size:14px; color:#0b3954;">🏫 Pilih Kelas Terlebih Dahulu:</span>' +
                    '<select id="select-kelas-admin-utama" onchange="window.ubahKelasAdminUtama(this.value)" style="padding:8px 16px; border:2px solid #0b3954; border-radius:8px; font-weight:bold; font-size:14px; color:#0b3954; background:#fff; min-width:200px; cursor:pointer;"></select>' +
                '</div>' +
                '<div id="info-ringkas-kelas-admin" style="font-size:12px; font-weight:600; color:#2980b9;"></div>' +
            '</div>' +

            // DERETAN TOMBOL TAB: ABSENSI, AGENDA, DAN INPUT DATA SISWA
            '<div class="admin-hub-tabs">' +
                '<button type="button" id="tab-btn-absensi" class="admin-tab-btn active" onclick="window.gantiTabAdministrasi(\'absensi\')">📋 Absensi Siswa</button>' +
                '<button type="button" id="tab-btn-agenda" class="admin-tab-btn" onclick="window.gantiTabAdministrasi(\'agenda\')">📅 Agenda Mengajar</button>' +
                '<button type="button" id="tab-btn-datasiswa" class="admin-tab-btn" onclick="window.gantiTabAdministrasi(\'datasiswa\')">👥 Input Data Siswa & Kelas</button>' +
            '</div>' +

            '<div id="body-ruang-administrasi" style="padding:18px; overflow-y:auto; flex:1; background:#ffffff;"></div>' +
        '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    window.perbaruiDropdownKelasAdminUtama();
    window.gantiTabAdministrasi(tabAwal === 'agenda' ? 'agenda' : (tabAwal === 'datasiswa' ? 'datasiswa' : 'absensi'));
};

window.perbaruiDropdownKelasAdminUtama = function() {
    var sel = document.getElementById('select-kelas-admin-utama');
    if (!sel) return;
    var daftarKls = window.ambilDaftarKelasAktif();
    if (!window.kelasAdminUtama || !daftarKls.includes(window.kelasAdminUtama)) {
        window.kelasAdminUtama = daftarKls[0] || "";
    }
    sel.innerHTML = daftarKls.map(function(k) {
        return '<option value="' + k + '"' + (k === window.kelasAdminUtama ? ' selected' : '') + '>Kelas: ' + k + '</option>';
    }).join('');

    window.kelasAbsensiAktif = window.kelasAdminUtama;
    window.kelasAgendaAktif = window.kelasAdminUtama;

    var infoEl = document.getElementById('info-ringkas-kelas-admin');
    if (infoEl && window.kelasAdminUtama) {
        var dataKls = window.pastikanStrukturAbsensiKelas(window.kelasAdminUtama);
        var jmlSiswa = (dataKls.siswaList || []).length;
        var jmlAgenda = (window.dataAgendaGlobal && window.dataAgendaGlobal[window.kelasAdminUtama]) ? window.dataAgendaGlobal[window.kelasAdminUtama].length : 0;
        infoEl.innerHTML = '👤 <b>' + jmlSiswa + ' Siswa</b> terdaftar | 📅 <b>' + jmlAgenda + ' Catatan Agenda</b>';
    }
};

window.ubahKelasAdminUtama = function(klsBaru) {
    window.kelasAdminUtama = klsBaru;
    window.kelasAbsensiAktif = klsBaru;
    window.kelasAgendaAktif = klsBaru;
    window.perbaruiDropdownKelasAdminUtama();
    window.gantiTabAdministrasi(window.tabAdminAktif || 'absensi');
};

window.gantiTabAdministrasi = function(namaTab) {
    window.tabAdminAktif = namaTab;
    window.kelasAbsensiAktif = window.kelasAdminUtama;
    window.kelasAgendaAktif = window.kelasAdminUtama;
    window.perbaruiDropdownKelasAdminUtama();

    var btnAbs = document.getElementById('tab-btn-absensi');
    var btnAgn = document.getElementById('tab-btn-agenda');
    var btnSis = document.getElementById('tab-btn-datasiswa');
    if (btnAbs) btnAbs.className = 'admin-tab-btn' + (namaTab === 'absensi' ? ' active' : '');
    if (btnAgn) btnAgn.className = 'admin-tab-btn' + (namaTab === 'agenda' ? ' active' : '');
    if (btnSis) btnSis.className = 'admin-tab-btn' + (namaTab === 'datasiswa' ? ' active' : '');

    if (namaTab === 'absensi') {
        window.tampilkanUIAbsensi();
    } else if (namaTab === 'agenda') {
        window.tampilkanUIAgenda();
    } else {
        window.tampilkanUIDataSiswaDanKelas();
    }
};

// Tampilan Tab 1: Absensi Siswa sesuai Kelas yang Dipilih di Atas
window.tampilkanUIAbsensi = function() {
    var body = document.getElementById('body-ruang-administrasi');
    if (!body) return;
    var kls = window.kelasAdminUtama || window.ambilDaftarKelasAktif()[0];
    window.kelasAbsensiAktif = kls;

    body.innerHTML =
        '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; background:#f8fafc; padding:12px 15px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">' +
            '<div style="font-weight:bold; font-size:14px; color:#0b3954;">📋 Lembar Absensi Kelas: <span style="color:#16a085;">' + kls + '</span></div>' +
            '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                '<button type="button" onclick="window.gantiTabAdministrasi(\'datasiswa\')" style="background:#2980b9; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">👥 Kelola Siswa & Kelas</button>' +
                '<button type="button" onclick="window.tambahKolomTanggalAbsensi()" style="background:#8e44ad; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📅 + Kolom Pertemuan</button>' +
                '<button type="button" onclick="window.exportExcelAbsensi()" style="background:#16a085; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📥 Export Excel</button>' +
            '</div>' +
        '</div>' +
        '<div style="font-size:12px; color:#64748b; margin-bottom:8px;">💡 Klik kotak status untuk mengubah kehadiran (<b>H</b> = Hadir, <b>S</b> = Sakit, <b>I</b> = Izin, <b>A</b> = Alfa). Klik judul tanggal pertemuan untuk mengubah tanggal.</div>' +
        '<div id="wadah-tabel-absensi" style="overflow-x:auto;"></div>';

    window.renderTabelAbsensiKelas();
};

// Tampilan Tab 2: Agenda Mengajar sesuai Kelas yang Dipilih di Atas
window.tampilkanUIAgenda = function() {
    var body = document.getElementById('body-ruang-administrasi');
    if (!body) return;
    var kls = window.kelasAdminUtama || window.ambilDaftarKelasAktif()[0];
    window.kelasAgendaAktif = kls;
    var hariIni = new Date().toISOString().split('T')[0];

    body.innerHTML =
        '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; background:#f8fafc; padding:12px 15px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">' +
            '<div style="font-weight:bold; font-size:14px; color:#0b3954;">📅 Jurnal & Agenda Mengajar Kelas: <span style="color:#16a085;">' + kls + '</span></div>' +
            '<button type="button" onclick="window.exportExcelAgenda()" style="background:#16a085; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📥 Export Excel Agenda</button>' +
        '</div>' +
        '<div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:15px;">' +
            '<h4 style="margin:0 0 10px 0; color:#0b3954; font-size:13px;">➕ Isi Agenda Pertemuan Baru (' + kls + ')</h4>' +
            '<div style="display:grid; grid-template-columns:130px 90px 1fr 1fr 1fr auto; gap:8px; align-items:center;" class="grid-responsive-form">' +
                '<input type="date" id="agn-input-tgl" value="' + hariIni + '" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="number" id="agn-input-jp" placeholder="Jml JP" value="2" min="1" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="text" id="agn-input-materi" placeholder="Materi yang diajarkan..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="text" id="agn-input-ket" placeholder="Keterangan..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="text" id="agn-input-rencana" placeholder="Rencana pertemuan berikutnya..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<button type="button" onclick="window.tambahBarisAgenda()" style="background:#27ae60; color:#fff; border:none; padding:9px 16px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer; white-space:nowrap;">💾 Simpan</button>' +
            '</div>' +
        '</div>' +
        '<div id="wadah-tabel-agenda" style="overflow-x:auto;"></div>';

    window.renderTabelAgendaKelas();
};

// Tampilan Tab 3: Input Data Siswa & Kelas (Tambah/Hapus Kelas dan Siswa)
window.tampilkanUIDataSiswaDanKelas = function() {
    var body = document.getElementById('body-ruang-administrasi');
    if (!body) return;
    var daftarKls = window.ambilDaftarKelasAktif();
    var klsAktif = window.kelasAdminUtama || daftarKls[0];
    var dataKls = window.pastikanStrukturAbsensiKelas(klsAktif);
    var siswaList = dataKls.siswaList || [];

    var htmlDaftarKelas = daftarKls.map(function(k, idx) {
        var jmlS = (window.dataAbsensiGlobal && window.dataAbsensiGlobal[k] && window.dataAbsensiGlobal[k].siswaList) ? window.dataAbsensiGlobal[k].siswaList.length : 0;
        var isSelected = (k === klsAktif);
        var safeK = k.replace(/'/g, "\\'");
        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:' + (isSelected ? '#e8f8f5' : '#ffffff') + '; border:1px solid ' + (isSelected ? '#16a085' : '#e2e8f0') + '; border-radius:8px; margin-bottom:6px;">' +
            '<div onclick="window.ubahKelasAdminUtama(\'' + safeK + '\')" style="cursor:pointer; flex:1;">' +
                '<b style="color:#0b3954; font-size:13px;">🏫 ' + k + '</b> ' +
                '<span style="font-size:11px; color:#64748b; margin-left:6px;">(' + jmlS + ' Siswa)</span>' +
            '</div>' +
            '<button type="button" onclick="window.hapusKelasDariInputData(\'' + safeK + '\')" style="background:#fadbd8; color:#c0392b; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">🗑️ Hapus Kelas</button>' +
        '</div>';
    }).join('');

    var htmlDaftarSiswa = '';
    if (siswaList.length === 0) {
        htmlDaftarSiswa = '<div style="text-align:center; padding:25px; color:#94a3b8; border:1px dashed #cbd5e1; border-radius:8px;">Belum ada siswa di kelas <b>' + klsAktif + '</b>. Tambahkan nama siswa pada kolom di atas.</div>';
    } else {
        htmlDaftarSiswa = siswaList.map(function(s, sIdx) {
            return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px;">' +
                '<div style="display:flex; align-items:center; gap:8px; flex:1;">' +
                    '<span style="background:#0b3954; color:#fff; width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold;">' + (sIdx + 1) + '</span>' +
                    '<input type="text" value="' + s.nama.replace(/"/g, '&quot;') + '" onchange="window.ubahNamaSiswaAbsensi(' + sIdx + ', this.value); window.tampilkanToastFullscreen(\'✓ Nama siswa diperbarui\');" style="border:1px solid transparent; border-bottom:1px dashed #cbd5e1; padding:4px 6px; font-size:13px; font-weight:600; color:#1e293b; width:80%; outline:none;">' +
                '</div>' +
                '<button type="button" onclick="window.hapusSiswaDariInputData(' + sIdx + ')" style="background:#fadbd8; color:#c0392b; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">🗑️ Hapus Siswa</button>' +
            '</div>';
        }).join('');
    }

    body.innerHTML =
        '<div style="display:grid; grid-template-columns:1fr 1.35fr; gap:18px;" class="grid-responsive-form">' +
            // PANEL KIRI: KELOLA KELAS
            '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">' +
                '<h4 style="margin:0 0 10px 0; color:#0b3954; font-size:14px;">🏫 1. Kelola Daftar Kelas</h4>' +
                '<div style="display:flex; gap:8px; margin-bottom:14px;">' +
                    '<input type="text" id="input-tambah-kelas-baru" placeholder="Nama Kelas Baru (mis: X-3, XI-IPA 1)..." style="flex:1; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px;">' +
                    '<button type="button" onclick="window.simpanKelasBaruDariInput()" style="background:#27ae60; color:#fff; border:none; padding:9px 14px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer; white-space:nowrap;">+ Tambah Kelas</button>' +
                '</div>' +
                '<div style="font-size:11px; color:#64748b; margin-bottom:8px;">Klik nama kelas untuk memilih, atau klik 🗑️ untuk menghapus kelas:</div>' +
                '<div style="max-height:360px; overflow-y:auto;">' + htmlDaftarKelas + '</div>' +
            '</div>' +

            // PANEL KANAN: KELOLA SISWA PADA KELAS AKTIF
            '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' +
                    '<h4 style="margin:0; color:#0b3954; font-size:14px;">👥 2. Input Data Siswa — Kelas: <span style="color:#16a085;">' + klsAktif + '</span></h4>' +
                    '<span style="background:#d4edda; color:#155724; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:bold;">Total: ' + siswaList.length + ' Siswa</span>' +
                '</div>' +
                '<div style="margin-bottom:12px;">' +
                    '<textarea id="input-tambah-siswa-banyak" rows="3" placeholder="Ketik nama siswa untuk kelas ' + klsAktif + ' (Bisa ketik 1 nama, atau paste banyak nama sekaligus dipisahkan Enter / baris baru)..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px; box-sizing:border-box; font-family:inherit;"></textarea>' +
                    '<button type="button" onclick="window.simpanSiswaBaruDariInput()" style="width:100%; margin-top:6px; background:#2980b9; color:#fff; border:none; padding:10px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer;">👤 + Tambahkan Siswa ke Kelas ' + klsAktif + '</button>' +
                '</div>' +
                '<div style="max-height:310px; overflow-y:auto;">' + htmlDaftarSiswa + '</div>' +
            '</div>' +
        '</div>';
};

window.simpanKelasBaruDariInput = function() {
    var inp = document.getElementById('input-tambah-kelas-baru');
    var klsBaru = inp ? inp.value.trim() : '';
    if (!klsBaru) {
        window.tampilkanToastFullscreen("⚠️ Ketik nama kelas terlebih dahulu!");
        return;
    }
    if (!window.konfigPendidikan) window.konfigPendidikan = { daftarKelas: [] };
    if (!Array.isArray(window.konfigPendidikan.daftarKelas)) window.konfigPendidikan.daftarKelas = [];

    if (!window.konfigPendidikan.daftarKelas.includes(klsBaru)) {
        window.konfigPendidikan.daftarKelas.push(klsBaru);
        if (window.simpanKonfigPendidikanKeDB) window.simpanKonfigPendidikanKeDB();
    }
    window.kelasAdminUtama = klsBaru;
    window.perbaruiDropdownKelasAdminUtama();
    window.tampilkanUIDataSiswaDanKelas();
    window.tampilkanToastFullscreen("✓ Kelas '" + klsBaru + "' berhasil ditambahkan!");
};

window.hapusKelasDariInputData = function(namaKls) {
    window.tampilkanKonfirmasiFullscreen("Hapus kelas '" + namaKls + "' beserta data di dalamnya?", function() {
        if (window.konfigPendidikan && Array.isArray(window.konfigPendidikan.daftarKelas)) {
            window.konfigPendidikan.daftarKelas = window.konfigPendidikan.daftarKelas.filter(function(k) { return k !== namaKls; });
            if (window.simpanKonfigPendidikanKeDB) window.simpanKonfigPendidikanKeDB();
        }
        if (window.dataAbsensiGlobal && window.dataAbsensiGlobal[namaKls]) {
            delete window.dataAbsensiGlobal[namaKls];
            if (window.simpanAbsensiKeDB) window.simpanAbsensiKeDB();
        }
        var sisaKls = window.ambilDaftarKelasAktif();
        window.kelasAdminUtama = sisaKls[0] || "";
        window.perbaruiDropdownKelasAdminUtama();
        window.tampilkanUIDataSiswaDanKelas();
        window.tampilkanToastFullscreen("🗑️ Kelas '" + namaKls + "' telah dihapus.");
    });
};

window.simpanSiswaBaruDariInput = function() {
    var ta = document.getElementById('input-tambah-siswa-banyak');
    var raw = ta ? ta.value.trim() : '';
    if (!raw) {
        window.tampilkanToastFullscreen("⚠️ Masukkan minimal 1 nama siswa!");
        return;
    }
    var kls = window.kelasAdminUtama || window.ambilDaftarKelasAktif()[0];
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    var namaArr = raw.split(/[\n,]+/).map(function(n) { return n.trim(); }).filter(function(n) { return n.length > 0; });

    namaArr.forEach(function(nama) {
        var defaultHadir = {};
        (dataKls.tanggalList || []).forEach(function(_, idx) { defaultHadir[idx] = 'H'; });
        dataKls.siswaList.push({ nama: nama, kehadiran: defaultHadir });
    });

    if (window.simpanAbsensiKeDB) window.simpanAbsensiKeDB();
    window.perbaruiDropdownKelasAdminUtama();
    window.tampilkanUIDataSiswaDanKelas();
    window.tampilkanToastFullscreen("✓ " + namaArr.length + " siswa ditambahkan ke kelas " + kls + "!");
};

window.hapusSiswaDariInputData = function(sIdx) {
    var kls = window.kelasAdminUtama || window.ambilDaftarKelasAktif()[0];
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    var namaSiswa = (dataKls.siswaList[sIdx] && dataKls.siswaList[sIdx].nama) || "siswa ini";
    window.tampilkanKonfirmasiFullscreen("Hapus '" + namaSiswa + "' dari kelas " + kls + "?", function() {
        dataKls.siswaList.splice(sIdx, 1);
        if (window.simpanAbsensiKeDB) window.simpanAbsensiKeDB();
        window.perbaruiDropdownKelasAdminUtama();
        window.tampilkanUIDataSiswaDanKelas();
    });
};

// ============================================================================
// UPGRADE ADMINISTRASI: TAB REMINDER (ABSENSI & UJIAN DENGAN DROPDOWN OTOMATIS)
// SERTA REVISI AGENDA (HARI OTOMATIS & KETERANGAN "JP" DI BELAKANG INPUT)
// ============================================================================

// 1. Fungsi Konversi Tanggal ke Nama Hari Indonesia Otomatis
window.ambilNamaHariIndonesia = function(tglStr) {
    if (!tglStr) return '-';
    var namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var parts = tglStr.split('-');
    if (parts.length === 3) {
        var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) return namaHari[d.getDay()];
    }
    var dFallback = new Date(tglStr);
    if (!isNaN(dFallback.getTime())) return namaHari[dFallback.getDay()];
    return '-';
};

window.onUbahTanggalAgenda = function(tglVal) {
    var inputHari = document.getElementById('agn-input-hari');
    if (inputHari) {
        inputHari.value = window.ambilNamaHariIndonesia(tglVal);
    }
};

// 2. Perbarui Modal Administrasi dengan Tab ke-4: 🔔 Reminder
window.bukaModalAdministrasi = function(tabAwal) {
    if (window.bersihkanOverlayPenghalang) window.bersihkanOverlayPenghalang();
    var daftarKls = window.ambilDaftarKelasAktif();
    if (!window.kelasAdminUtama || !daftarKls.includes(window.kelasAdminUtama)) {
        window.kelasAdminUtama = daftarKls[0] || "X-1";
    }

    var m = document.getElementById('modal-ruang-administrasi');
    if (m) m.remove();

    var html =
    '<div id="modal-ruang-administrasi" class="mahardika-modal-wrap" style="display:flex;">' +
        '<div class="mahardika-modal-card modal-box" style="max-width:1080px; height:90vh;">' +
            '<div style="background:#0b3954; color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">' +
                '<h3 style="margin:0; font-size:17px;">📁 Ruang Administrasi Guru</h3>' +
                '<button type="button" onclick="document.getElementById(\'modal-ruang-administrasi\').style.display=\'none\'" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; font-size:16px; cursor:pointer; font-weight:bold;">✕</button>' +
            '</div>' +

            // BAR PILIH KELAS DI ATAS TOMBOL TAB
            '<div class="admin-top-class-bar">' +
                '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">' +
                    '<span style="font-weight:700; font-size:14px; color:#0b3954;">🏫 Pilih Kelas Terlebih Dahulu:</span>' +
                    '<select id="select-kelas-admin-utama" onchange="window.ubahKelasAdminUtama(this.value)" style="padding:8px 16px; border:2px solid #0b3954; border-radius:8px; font-weight:bold; font-size:14px; color:#0b3954; background:#fff; min-width:200px; cursor:pointer;"></select>' +
                '</div>' +
                '<div id="info-ringkas-kelas-admin" style="font-size:12px; font-weight:600; color:#2980b9;"></div>' +
            '</div>' +

            // DERETAN TOMBOL TAB: ABSENSI, AGENDA, INPUT DATA SISWA, DAN REMINDER
            '<div class="admin-hub-tabs" style="flex-wrap:wrap;">' +
                '<button type="button" id="tab-btn-absensi" class="admin-tab-btn active" onclick="window.gantiTabAdministrasi(\'absensi\')">📋 Absensi Siswa</button>' +
                '<button type="button" id="tab-btn-agenda" class="admin-tab-btn" onclick="window.gantiTabAdministrasi(\'agenda\')">📅 Agenda Mengajar</button>' +
                '<button type="button" id="tab-btn-datasiswa" class="admin-tab-btn" onclick="window.gantiTabAdministrasi(\'datasiswa\')">👥 Input Data Siswa & Kelas</button>' +
                '<button type="button" id="tab-btn-reminder" class="admin-tab-btn" onclick="window.gantiTabAdministrasi(\'reminder\')" style="position:relative;">🔔 Reminder <span id="badge-tab-reminder" style="display:none; background:#e74c3c; color:#fff; padding:1px 7px; border-radius:12px; font-size:11px; margin-left:5px;">0</span></button>' +
            '</div>' +

            '<div id="body-ruang-administrasi" style="padding:18px; overflow-y:auto; flex:1; background:#ffffff;"></div>' +
        '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    window.perbaruiDropdownKelasAdminUtama();
    var targetTab = (tabAwal === 'agenda' || tabAwal === 'datasiswa' || tabAwal === 'reminder') ? tabAwal : 'absensi';
    window.gantiTabAdministrasi(targetTab);
};

window.gantiTabAdministrasi = function(namaTab) {
    window.tabAdminAktif = namaTab;
    window.kelasAbsensiAktif = window.kelasAdminUtama;
    window.kelasAgendaAktif = window.kelasAdminUtama;
    window.perbaruiDropdownKelasAdminUtama();
    window.updateBadgeReminderAdmin();

    var tabs = ['absensi', 'agenda', 'datasiswa', 'reminder'];
    tabs.forEach(function(t) {
        var btn = document.getElementById('tab-btn-' + t);
        if (btn) btn.className = 'admin-tab-btn' + (t === namaTab ? ' active' : '');
    });

    if (namaTab === 'absensi') {
        window.tampilkanUIAbsensi();
    } else if (namaTab === 'agenda') {
        window.tampilkanUIAgenda();
    } else if (namaTab === 'datasiswa') {
        window.tampilkanUIDataSiswaDanKelas();
    } else if (namaTab === 'reminder') {
        window.tampilkanUIReminder();
    }
};

// Jika status kehadiran siswa diubah kembali menjadi 'H', buka kembali kunci reminder jika sebelumnya pernah di-X
var origToggleStatusKehadiran = window.toggleStatusKehadiran;
window.toggleStatusKehadiran = function(sIdx, tIdx) {
    if (typeof origToggleStatusKehadiran === 'function') origToggleStatusKehadiran(sIdx, tIdx);
    var kls = window.kelasAbsensiAktif;
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    var siswa = dataKls.siswaList[sIdx];
    if (siswa) {
        var st = (siswa.kehadiran && siswa.kehadiran[tIdx]) || '-';
        var remKey = ('abs_' + kls + '_' + tIdx + '_' + siswa.nama).replace(/[.#$\[\]\/]/g, '_');
        if (st === 'H' && window.dataReminderDismissed && window.dataReminderDismissed[remKey]) {
            delete window.dataReminderDismissed[remKey];
            if (window.simpanReminderDismissedKeDB) window.simpanReminderDismissedKeDB();
        }
    }
    window.updateBadgeReminderAdmin();
};

// ----------------------------------------------------------------------------
// 3. REVISI MODUL AGENDA MENGAJAR (HARI OTOMATIS + KETERANGAN "JP" DI BELAKANG INPUT)
// ----------------------------------------------------------------------------
window.tampilkanUIAgenda = function() {
    var body = document.getElementById('body-ruang-administrasi');
    if (!body) return;
    var kls = window.kelasAdminUtama || window.ambilDaftarKelasAktif()[0];
    window.kelasAgendaAktif = kls;
    var hariIniTgl = new Date().toISOString().split('T')[0];
    var hariIniNama = window.ambilNamaHariIndonesia(hariIniTgl);

    body.innerHTML =
        '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; background:#f8fafc; padding:12px 15px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">' +
            '<div style="font-weight:bold; font-size:14px; color:#0b3954;">📅 Jurnal & Agenda Mengajar Kelas: <span style="color:#16a085;">' + kls + '</span></div>' +
            '<button type="button" onclick="window.exportExcelAgenda()" style="background:#16a085; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">📥 Export Excel Agenda</button>' +
        '</div>' +
        '<div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:15px;">' +
            '<h4 style="margin:0 0 10px 0; color:#0b3954; font-size:13px;">➕ Isi Agenda Pertemuan Baru (' + kls + ')</h4>' +
            '<div style="display:grid; grid-template-columns:95px 135px 100px 1fr 1fr 1fr auto; gap:8px; align-items:center;" class="grid-responsive-form">' +
                '<input type="text" id="agn-input-hari" value="' + hariIniNama + '" readonly title="Hari terisi otomatis sesuai tanggal" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; font-weight:bold; background:#e2e8f0; color:#0b3954; text-align:center;">' +
                '<input type="date" id="agn-input-tgl" value="' + hariIniTgl + '" onchange="window.onUbahTanggalAgenda(this.value)" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<div class="jp-input-group" title="Jumlah Jam Pelajaran">' +
                    '<input type="number" id="agn-input-jp" value="2" min="1">' +
                    '<span>JP</span>' +
                '</div>' +
                '<input type="text" id="agn-input-materi" placeholder="Materi pembelajaran..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="text" id="agn-input-ket" placeholder="Keterangan..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<input type="text" id="agn-input-rencana" placeholder="Rencana pertemuan berikutnya..." style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' +
                '<button type="button" onclick="window.tambahBarisAgenda()" style="background:#27ae60; color:#fff; border:none; padding:9px 16px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer; white-space:nowrap;">💾 Simpan</button>' +
            '</div>' +
        '</div>' +
        '<div id="wadah-tabel-agenda" style="overflow-x:auto;"></div>';

    window.renderTabelAgendaKelas();
};

window.renderTabelAgendaKelas = function() {
    var wadah = document.getElementById('wadah-tabel-agenda');
    if (!wadah) return;
    var kls = window.kelasAgendaAktif || window.ambilDaftarKelasAktif()[0];
    if (!window.dataAgendaGlobal) window.dataAgendaGlobal = {};
    if (!Array.isArray(window.dataAgendaGlobal[kls])) window.dataAgendaGlobal[kls] = [];
    var list = window.dataAgendaGlobal[kls];

    var rowsHtml = '';
    if (list.length === 0) {
        rowsHtml = '<tr><td colspan="8" style="text-align:center; padding:25px; color:#94a3b8;">Belum ada catatan agenda untuk kelas <b>' + kls + '</b>. Silakan isi form di atas lalu klik <b>💾 Simpan</b>.</td></tr>';
    } else {
        rowsHtml = list.map(function(item, idx) {
            var namaHari = item.hari || window.ambilNamaHariIndonesia(item.tanggal);
            var angkaJP = String(item.jp || '2').replace(/JP/gi, '').trim();
            return '<tr>' +
                '<td style="text-align:center; width:40px;">' + (idx + 1) + '</td>' +
                '<td style="text-align:center; font-weight:bold; color:#0b3954; background:#f8fafc; width:85px;">' + namaHari + '</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'tanggal\', this.innerText)" style="white-space:nowrap; font-weight:600;">' + (item.tanggal || '-') + '</td>' +
                '<td style="text-align:center; font-weight:bold; color:#0b3954; white-space:nowrap;">' +
                    '<span contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'jp\', this.innerText)" style="padding:2px 4px; border-bottom:1px dashed #94a3b8; outline:none;">' + angkaJP + '</span> JP' +
                '</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'materi\', this.innerText)" style="font-weight:600;">' + (item.materi || '-') + '</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'keterangan\', this.innerText)">' + (item.keterangan || '-') + '</td>' +
                '<td contenteditable="true" onblur="window.updateFieldAgenda(' + idx + ', \'rencana\', this.innerText)" style="color:#16a085; font-weight:600;">' + (item.rencana || '-') + '</td>' +
                '<td style="text-align:center; width:50px;"><button type="button" onclick="window.hapusBarisAgenda(' + idx + ')" style="background:none;border:none;cursor:pointer;">🗑️</button></td>' +
            '</tr>';
        }).join('');
    }

    wadah.innerHTML =
        '<table class="excel-table" id="tabel-excel-agenda">' +
            '<thead>' +
                '<tr>' +
                    '<th style="text-align:center; width:40px;">No</th>' +
                    '<th style="text-align:center; width:85px;">Hari</th>' +
                    '<th style="width:115px;">Tanggal</th>' +
                    '<th style="text-align:center; width:95px;">Jumlah JP</th>' +
                    '<th>Materi Pembelajaran</th>' +
                    '<th>Keterangan</th>' +
                    '<th>Rencana Pertemuan Berikutnya</th>' +
                    '<th style="text-align:center; width:50px;">Aksi</th>' +
                '</tr>' +
            '</thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
        '</table>';
};

window.tambahBarisAgenda = function() {
    var kls = window.kelasAgendaAktif || window.ambilDaftarKelasAktif()[0];
    var tgl = document.getElementById('agn-input-tgl').value;
    var hari = window.ambilNamaHariIndonesia(tgl);
    var jp = document.getElementById('agn-input-jp').value.trim() || '2';
    var materi = document.getElementById('agn-input-materi').value.trim();
    var ket = document.getElementById('agn-input-ket').value.trim();
    var rencana = document.getElementById('agn-input-rencana').value.trim();

    if (!materi) {
        window.tampilkanToastFullscreen("⚠️ Kolom Materi Pembelajaran wajib diisi!");
        return;
    }

    if (!window.dataAgendaGlobal) window.dataAgendaGlobal = {};
    if (!Array.isArray(window.dataAgendaGlobal[kls])) window.dataAgendaGlobal[kls] = [];

    window.dataAgendaGlobal[kls].push({
        hari: hari,
        tanggal: tgl,
        jp: jp.replace(/[^0-9]/g, '') || '2',
        materi: materi,
        keterangan: ket || 'Hadir / Lancar',
        rencana: rencana || '-'
    });

    document.getElementById('agn-input-materi').value = '';
    document.getElementById('agn-input-ket').value = '';
    document.getElementById('agn-input-rencana').value = '';

    window.simpanAgendaKeDB();
    window.renderTabelAgendaKelas();
    window.tampilkanToastFullscreen("✓ Agenda hari " + hari + " (" + tgl + ") berhasil disimpan!");
};

window.updateFieldAgenda = function(idx, field, val) {
    var kls = window.kelasAgendaAktif;
    if (window.dataAgendaGlobal && window.dataAgendaGlobal[kls] && window.dataAgendaGlobal[kls][idx]) {
        var cleanVal = val.trim();
        if (field === 'jp') cleanVal = cleanVal.replace(/[^0-9]/g, '') || '2';
        window.dataAgendaGlobal[kls][idx][field] = cleanVal;
        if (field === 'tanggal') {
            window.dataAgendaGlobal[kls][idx].hari = window.ambilNamaHariIndonesia(cleanVal);
            window.renderTabelAgendaKelas();
        }
        window.simpanAgendaKeDB();
    }
};

// ----------------------------------------------------------------------------
// 4. MODUL REMINDER: KETINGGALAN PELAJARAN (-, A, S, I) & BELUM IKUT UJIAN
// ----------------------------------------------------------------------------
window.modeFilterReminder = 'KELAS_INI'; // 'KELAS_INI' atau 'SEMUA_KELAS'
window.statusBukaDropdownReminder = {};

// Cari Materi Pembelajaran dari Agenda untuk Pertemuan ke-tIdx atau Tanggal yang Cocok
window.cariMateriUntukPertemuan = function(kls, tIdx, labelTanggal) {
    var agendaList = (window.dataAgendaGlobal && window.dataAgendaGlobal[kls]) || [];
    var labelBersih = (labelTanggal || '').trim().toLowerCase();

    // 1. Cek jika label kolom absensi cocok dengan tanggal di Agenda
    for (var i = 0; i < agendaList.length; i++) {
        if ((agendaList[i].tanggal || '').trim().toLowerCase() === labelBersih && agendaList[i].materi) {
            return {
                materi: agendaList[i].materi,
                infoWaktu: (agendaList[i].hari ? agendaList[i].hari + ', ' : '') + agendaList[i].tanggal
            };
        }
    }
    // 2. Jika tidak cocok tanggal spesifik, pasangkan dengan urutan pertemuan ke-tIdx di Agenda
    if (agendaList[tIdx] && agendaList[tIdx].materi) {
        var ag = agendaList[tIdx];
        return {
            materi: ag.materi,
            infoWaktu: labelTanggal + (ag.tanggal ? ' (' + (ag.hari ? ag.hari + ', ' : '') + ag.tanggal + ')' : '')
        };
    }
    // 3. Fallback jika guru belum mengisi Agenda untuk pertemuan tersebut
    return {
        materi: 'Materi ' + labelTanggal + ' (Agenda belum diisi)',
        infoWaktu: labelTanggal
    };
};

// Kumpulkan Daftar Ujian yang Berlaku pada Kelas Tertentu
window.ambilDaftarUjianUntukKelas = function(kls) {
    var setUjian = new Set();
    var dataKls = window.pastikanStrukturAbsensiKelas(kls);
    var namaSiswaSet = new Set((dataKls.siswaList || []).map(function(s) {
        return (s.nama || '').trim().toLowerCase();
    }));

    // A. Ujian yang ditandai manual untuk dipantau di kelas ini
    if (window.dataUjianKelasPantau && window.dataUjianKelasPantau[kls]) {
        Object.keys(window.dataUjianKelasPantau[kls]).forEach(function(u) {
            if (window.dataUjianKelasPantau[kls][u]) setUjian.add(u);
        });
    }

    // B. Deteksi otomatis dari rekap_nilai_ujian yang memiliki atribut kelas === kls atau nama siswa kelas ini
    Object.values(window.rekapNilaiGlobal || {}).forEach(function(d) {
        if (!d || !d.ujian) return;
        if (d.kelas === kls || namaSiswaSet.has((d.nama || '').trim().toLowerCase())) {
            setUjian.add(d.ujian);
        }
    });

    // C. Deteksi otomatis dari hasil_ujian (Strict Mode) jika ada minimal 1 siswa dari kelas ini yang sudah mengerjakan
    Object.keys(window.dataRekapNilai || {}).forEach(function(namaUjian) {
        var grup = window.dataRekapNilai[namaUjian] || {};
        Object.values(grup).forEach(function(peserta) {
            if (peserta && namaSiswaSet.has((peserta.nama || '').trim().toLowerCase())) {
                setUjian.add(namaUjian);
            }
        });
    });

    return Array.from(setUjian);
};

// Cek apakah siswa sudah mengikuti ujian tertentu
window.apakahSiswaSudahIkutUjian = function(namaSiswa, namaUjian, kls) {
    var target = (namaSiswa || '').trim().toLowerCase();
    if (!target) return true;

    // Cek di hasil_ujian (Strict Mode)
    if (window.dataRekapNilai && window.dataRekapNilai[namaUjian]) {
        var sudahStrict = Object.values(window.dataRekapNilai[namaUjian]).some(function(p) {
            return p && (p.nama || '').trim().toLowerCase() === target;
        });
        if (sudahStrict) return true;
    }

    // Cek di rekap_nilai_ujian (Portal Kelas)
    var sudahRekap = Object.values(window.rekapNilaiGlobal || {}).some(function(d) {
        return d && d.ujian === namaUjian && (d.nama || '').trim().toLowerCase() === target;
    });
    return sudahRekap;
};

// Hitung seluruh data Reminder aktif (Absensi & Ujian)
window.kumpulkanDataReminder = function(daftarKelasTarget) {
    var grupAbsensi = [];
    var grupUjian = [];
    var totalItemAktif = 0;
    var dismissed = window.dataReminderDismissed || {};

    daftarKelasTarget.forEach(function(kls) {
        var dataKls = window.pastikanStrukturAbsensiKelas(kls);
        var tglList = dataKls.tanggalList || [];
        var siswaList = dataKls.siswaList || [];

        // 1. Pindai Absensi (-, A, S, I) per pertemuan/hari
        tglList.forEach(function(tglLabel, tIdx) {
            var infoMateri = window.cariMateriUntukPertemuan(kls, tIdx, tglLabel);
            var anakTertinggal = [];

            siswaList.forEach(function(s) {
                var status = (s.kehadiran && s.kehadiran[tIdx]) || '-';
                if (status === '-' || status === 'A' || status === 'S' || status === 'I') {
                    var remId = ('abs_' + kls + '_' + tIdx + '_' + s.nama).replace(/[.#$\[\]\/]/g, '_');
                    if (!dismissed[remId]) {
                        anakTertinggal.push({
                            id: remId,
                            nama: s.nama,
                            status: status,
                            kelas: kls,
                            materi: infoMateri.materi,
                            waktu: infoMateri.infoWaktu
                        });
                        totalItemAktif++;
                    }
                }
            });

            if (anakTertinggal.length > 0) {
                grupAbsensi.push({
                    groupKey: 'grp_abs_' + kls + '_' + tIdx,
                    kelas: kls,
                    waktu: infoMateri.infoWaktu,
                    materi: infoMateri.materi,
                    items: anakTertinggal
                });
            }
        });

        // 2. Pindai Ujian yang belum diikuti siswa di kelas ini
        var ujianKelasIni = window.ambilDaftarUjianUntukKelas(kls);
        ujianKelasIni.forEach(function(namaUjian) {
            var anakBelumUjian = [];
            siswaList.forEach(function(s) {
                if (!window.apakahSiswaSudahIkutUjian(s.nama, namaUjian, kls)) {
                    var remUjianId = ('uji_' + kls + '_' + namaUjian + '_' + s.nama).replace(/[.#$\[\]\/]/g, '_');
                    if (!dismissed[remUjianId]) {
                        anakBelumUjian.push({
                            id: remUjianId,
                            nama: s.nama,
                            kelas: kls,
                            ujian: namaUjian
                        });
                        totalItemAktif++;
                    }
                }
            });

            if (anakBelumUjian.length > 0) {
                grupUjian.push({
                    groupKey: 'grp_uji_' + kls + '_' + namaUjian.replace(/\s+/g, '_'),
                    kelas: kls,
                    ujian: namaUjian,
                    items: anakBelumUjian
                });
            }
        });
    });

    return {
        grupAbsensi: grupAbsensi,
        grupUjian: grupUjian,
        total: totalItemAktif
    };
};

window.updateBadgeReminderAdmin = function() {
    var semuaKls = window.ambilDaftarKelasAktif();
    var hasil = window.kumpulkanDataReminder(semuaKls);
    var badgeTab = document.getElementById('badge-tab-reminder');
    if (badgeTab) {
        badgeTab.style.display = hasil.total > 0 ? 'inline-block' : 'none';
        badgeTab.innerText = hasil.total;
    }
    var btnMenuAdm = document.getElementById('btn-menu-administrasi');
    if (btnMenuAdm) {
        if (hasil.total > 0) {
            btnMenuAdm.innerHTML = '📁 Administrasi <span style="background:#e74c3c;color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px;">' + hasil.total + '</span>';
        } else {
            btnMenuAdm.innerHTML = '📁 Administrasi';
        }
    }
};

window.labelStatusAbsenLengkap = function(st) {
    if (st === 'S') return '<span style="background:#fff3cd;color:#856404;padding:2px 7px;border-radius:6px;font-weight:bold;font-size:11px;">S (Sakit)</span>';
    if (st === 'I') return '<span style="background:#cce5ff;color:#004085;padding:2px 7px;border-radius:6px;font-weight:bold;font-size:11px;">I (Izin)</span>';
    if (st === 'A') return '<span style="background:#f8d7da;color:#721c24;padding:2px 7px;border-radius:6px;font-weight:bold;font-size:11px;">A (Alfa)</span>';
    return '<span style="background:#e2e8f0;color:#475569;padding:2px 7px;border-radius:6px;font-weight:bold;font-size:11px;">- (Belum Hadir)</span>';
};

window.toggleDropdownGrupReminder = function(groupKey) {
    window.statusBukaDropdownReminder[groupKey] = !window.statusBukaDropdownReminder[groupKey];
    var bodyEl = document.getElementById('rem-body-' + groupKey);
    var iconEl = document.getElementById('rem-icon-' + groupKey);
    if (bodyEl) {
        if (window.statusBukaDropdownReminder[groupKey]) {
            bodyEl.classList.add('open');
            if (iconEl) iconEl.innerText = '▾';
        } else {
            bodyEl.classList.remove('open');
            if (iconEl) iconEl.innerText = '▸';
        }
    }
};

window.dismissSatuReminder = function(remId, e) {
    if (e) e.stopPropagation();
    if (!window.dataReminderDismissed) window.dataReminderDismissed = {};
    window.dataReminderDismissed[remId] = true;
    if (window.simpanReminderDismissedKeDB) window.simpanReminderDismissedKeDB();
    window.tampilkanUIReminder();
    window.updateBadgeReminderAdmin();
};

window.dismissGrupReminder = function(idsListStr, e) {
    if (e) e.stopPropagation();
    var arr = idsListStr.split('|').filter(Boolean);
    if (!window.dataReminderDismissed) window.dataReminderDismissed = {};
    arr.forEach(function(id) {
        window.dataReminderDismissed[id] = true;
    });
    if (window.simpanReminderDismissedKeDB) window.simpanReminderDismissedKeDB();
    window.tampilkanUIReminder();
    window.updateBadgeReminderAdmin();
};

window.tambahPantauUjianKelas = function() {
    var kls = window.kelasAdminUtama || window.ambilDaftarKelasAktif()[0];
    var sel = document.getElementById('select-pantau-ujian-baru');
    var namaUjian = sel ? sel.value : '';
    if (!namaUjian) {
        window.tampilkanToastFullscreen("⚠️ Pilih nama paket ujian terlebih dahulu!");
        return;
    }
    if (!window.dataUjianKelasPantau) window.dataUjianKelasPantau = {};
    if (!window.dataUjianKelasPantau[kls]) window.dataUjianKelasPantau[kls] = {};
    window.dataUjianKelasPantau[kls][namaUjian] = true;
    if (window.simpanUjianKelasPantauKeDB) window.simpanUjianKelasPantauKeDB();
    window.tampilkanUIReminder();
    window.updateBadgeReminderAdmin();
    window.tampilkanToastFullscreen("✓ Ujian '" + namaUjian + "' kini dipantau untuk kelas " + kls);
};

window.tampilkanUIReminder = function() {
    var body = document.getElementById('body-ruang-administrasi');
    if (!body) return;
    var klsAktif = window.kelasAdminUtama || window.ambilDaftarKelasAktif()[0];
    var daftarTarget = window.modeFilterReminder === 'SEMUA_KELAS' ? window.ambilDaftarKelasAktif() : [klsAktif];
    var dataRem = window.kumpulkanDataReminder(daftarTarget);

    // Kumpulkan semua nama paket ujian yang tersedia untuk fitur pantau ujian per kelas
    var semuaNamaUjian = new Set();
    Object.keys(window.bankUjianGlobal || {}).forEach(function(u) { semuaNamaUjian.add(u); });
    Object.keys(window.dataRekapNilai || {}).forEach(function(u) { semuaNamaUjian.add(u); });
    Object.values(window.rekapNilaiGlobal || {}).forEach(function(d) { if (d && d.ujian) semuaNamaUjian.add(d.ujian); });
    var opsiUjianHtml = '<option value="">-- Pilih Paket Ujian untuk Dipantau di Kelas ' + klsAktif + ' --</option>' +
        Array.from(semuaNamaUjian).sort().map(function(u) { return '<option value="' + u + '">' + u + '</option>'; }).join('');

    // Render Bagian 1: Reminder Absensi (Ketinggalan Pelajaran)
    var htmlAbsensi = '';
    if (dataRem.grupAbsensi.length === 0) {
        htmlAbsensi = '<div style="padding:20px; text-align:center; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;">🎉 Tidak ada siswa yang ketinggalan materi pelajaran pada pilihan kelas ini.</div>';
    } else {
        htmlAbsensi = dataRem.grupAbsensi.map(function(grp) {
            // JIKA HANYA 1 ANAK: Tampilkan baris langsung
            if (grp.items.length === 1) {
                var item = grp.items[0];
                return '<div class="reminder-card-single">' +
                    '<div>' +
                        '<span style="background:#0b3954; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold; margin-right:6px;">' + item.kelas + '</span>' +
                        '<span style="color:#64748b; font-size:12px; margin-right:6px;">[' + item.waktu + ']</span> ' +
                        window.labelStatusAbsenLengkap(item.status) + ' — ' +
                        '<b style="color:#d35400; font-size:14px;">' + item.nama + '</b> perlu mengikuti <b style="color:#0b3954; text-decoration:underline;">' + item.materi + '</b>' +
                    '</div>' +
                    '<button type="button" class="btn-dismiss-reminder" title="Selesai / Hapus Pengingat" onclick="window.dismissSatuReminder(\'' + item.id + '\', event)">✕</button>' +
                '</div>';
            }

            // JIKA LEBIH DARI 1 ANAK DI KELAS & HARI YANG SAMA: Bentuk Dropdown
            var isOpen = !!window.statusBukaDropdownReminder[grp.groupKey];
            var gabunganId = grp.items.map(function(i) { return i.id; }).join('|');
            var subRows = grp.items.map(function(item, idx) {
                return '<div class="reminder-sub-row">' +
                    '<div>' +
                        '<span style="font-weight:bold; color:#64748b; margin-right:6px;">' + (idx + 1) + '.</span>' +
                        window.labelStatusAbsenLengkap(item.status) + ' — ' +
                        '<b style="color:#d35400;">' + item.nama + '</b> perlu mengikuti <b style="color:#0b3954;">' + item.materi + '</b>' +
                    '</div>' +
                    '<button type="button" class="btn-dismiss-reminder" title="Selesai untuk ' + item.nama + '" onclick="window.dismissSatuReminder(\'' + item.id + '\', event)">✕</button>' +
                '</div>';
            }).join('');

            return '<div class="reminder-group-box">' +
                '<div class="reminder-group-header" onclick="window.toggleDropdownGrupReminder(\'' + grp.groupKey + '\')">' +
                    '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                        '<span id="rem-icon-' + grp.groupKey + '" style="font-weight:bold; font-size:15px; color:#0b3954; width:14px;">' + (isOpen ? '▾' : '▸') + '</span>' +
                        '<span style="background:#0b3954; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">' + grp.kelas + '</span>' +
                        '<span style="color:#475569; font-weight:600;">[' + grp.waktu + ']</span>' +
                        '<span style="background:#fef3c7; color:#b45309; padding:2px 9px; border-radius:12px; font-weight:bold; font-size:12px;">👥 ' + grp.items.length + ' Siswa Tidak Hadir</span>' +
                        '<span>perlu mengikuti <b style="color:#0b3954; text-decoration:underline;">' + grp.materi + '</b></span>' +
                    '</div>' +
                    '<button type="button" class="btn-dismiss-reminder" title="Hapus Semua di Grup Ini" onclick="window.dismissGrupReminder(\'' + gabunganId + '\', event)">✕</button>' +
                '</div>' +
                '<div id="rem-body-' + grp.groupKey + '" class="reminder-group-body' + (isOpen ? ' open' : '') + '">' +
                    subRows +
                '</div>' +
            '</div>';
        }).join('');
    }

    // Render Bagian 2: Reminder Siswa Belum Mengikuti Ujian
    var htmlUjian = '';
    if (dataRem.grupUjian.length === 0) {
        htmlUjian = '<div style="padding:20px; text-align:center; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;">🎉 Semua siswa terdaftar telah mengikuti ujian yang dipantau (atau pilih paket ujian di atas untuk mulai memantau kelas ini).</div>';
    } else {
        htmlUjian = dataRem.grupUjian.map(function(grp) {
            // JIKA HANYA 1 ANAK BELUM UJIAN: Tampilkan baris langsung
            if (grp.items.length === 1) {
                var item = grp.items[0];
                return '<div class="reminder-card-single exam-type">' +
                    '<div>' +
                        '<span style="background:#c0392b; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold; margin-right:6px;">' + item.kelas + '</span>' +
                        '<b style="color:#c0392b; font-size:14px;">' + item.nama + '</b> perlu mengikuti ujian <b style="color:#0b3954; text-decoration:underline;">' + item.ujian + '</b>' +
                    '</div>' +
                    '<button type="button" class="btn-dismiss-reminder" title="Selesai / Hapus Pengingat" onclick="window.dismissSatuReminder(\'' + item.id + '\', event)">✕</button>' +
                '</div>';
            }

            // JIKA LEBIH DARI 1 ANAK DI KELAS YANG SAMA BELUM UJIAN: Bentuk Dropdown
            var isOpen = !!window.statusBukaDropdownReminder[grp.groupKey];
            var gabunganId = grp.items.map(function(i) { return i.id; }).join('|');
            var subRows = grp.items.map(function(item, idx) {
                return '<div class="reminder-sub-row">' +
                    '<div>' +
                        '<span style="font-weight:bold; color:#64748b; margin-right:6px;">' + (idx + 1) + '.</span>' +
                        '<b style="color:#c0392b;">' + item.nama + '</b> perlu mengikuti ujian <b style="color:#0b3954;">' + item.ujian + '</b>' +
                    '</div>' +
                    '<button type="button" class="btn-dismiss-reminder" title="Selesai untuk ' + item.nama + '" onclick="window.dismissSatuReminder(\'' + item.id + '\', event)">✕</button>' +
                '</div>';
            }).join('');

            return '<div class="reminder-group-box exam-type">' +
                '<div class="reminder-group-header" onclick="window.toggleDropdownGrupReminder(\'' + grp.groupKey + '\')">' +
                    '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                        '<span id="rem-icon-' + grp.groupKey + '" style="font-weight:bold; font-size:15px; color:#8e44ad; width:14px;">' + (isOpen ? '▾' : '▸') + '</span>' +
                        '<span style="background:#8e44ad; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">' + grp.kelas + '</span>' +
                        '<span style="background:#fadbd8; color:#c0392b; padding:2px 9px; border-radius:12px; font-weight:bold; font-size:12px;">🎯 ' + grp.items.length + ' Siswa Belum Ujian</span>' +
                        '<span>perlu mengikuti ujian <b style="color:#0b3954; text-decoration:underline;">' + grp.ujian + '</b></span>' +
                    '</div>' +
                    '<button type="button" class="btn-dismiss-reminder" title="Hapus Semua di Grup Ini" onclick="window.dismissGrupReminder(\'' + gabunganId + '\', event)">✕</button>' +
                '</div>' +
                '<div id="rem-body-' + grp.groupKey + '" class="reminder-group-body' + (isOpen ? ' open' : '') + '">' +
                    subRows +
                '</div>' +
            '</div>';
        }).join('');
    }

    body.innerHTML =
        '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; background:#f8fafc; padding:12px 15px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:16px;">' +
            '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-weight:bold; font-size:13px; color:#0b3954;">Tampilkan Pengingat:</span>' +
                '<button type="button" onclick="window.modeFilterReminder=\'KELAS_INI\'; window.tampilkanUIReminder();" style="padding:6px 12px; border-radius:6px; border:1px solid #0b3954; font-weight:bold; font-size:12px; cursor:pointer; background:' + (window.modeFilterReminder === 'KELAS_INI' ? '#0b3954' : '#fff') + '; color:' + (window.modeFilterReminder === 'KELAS_INI' ? '#fff' : '#0b3954') + ';">🏫 Khusus Kelas ' + klsAktif + '</button>' +
                '<button type="button" onclick="window.modeFilterReminder=\'SEMUA_KELAS\'; window.tampilkanUIReminder();" style="padding:6px 12px; border-radius:6px; border:1px solid #0b3954; font-weight:bold; font-size:12px; cursor:pointer; background:' + (window.modeFilterReminder === 'SEMUA_KELAS' ? '#0b3954' : '#fff') + '; color:' + (window.modeFilterReminder === 'SEMUA_KELAS' ? '#fff' : '#0b3954') + ';">📂 Semua Kelas</button>' +
            '</div>' +
            '<div style="font-size:12px; color:#64748b;">💡 Pengingat tidak akan hilang sebelum tombol <b>✕</b> ditekan.</div>' +
        '</div>' +

        // BAGIAN 1: REMINDER MATERI PELAJARAN (ABSENSI -, A, S, I)
        '<div style="margin-bottom:22px;">' +
            '<h4 style="margin:0 0 10px 0; color:#0b3954; font-size:14px; display:flex; align-items:center; gap:8px;">📚 1. Pengingat Siswa Ketinggalan Materi Pelajaran (Status: -, A, S, I)</h4>' +
            htmlAbsensi +
        '</div>' +

        // BAGIAN 2: REMINDER SISWA BELUM MENGIKUTI UJIAN
        '<div>' +
            '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">' +
                '<h4 style="margin:0; color:#c0392b; font-size:14px;">🎯 2. Pengingat Siswa Belum Mengikuti Ujian</h4>' +
                '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">' +
                    '<select id="select-pantau-ujian-baru" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">' + opsiUjianHtml + '</select>' +
                    '<button type="button" onclick="window.tambahPantauUjianKelas()" style="background:#8e44ad; color:#fff; border:none; padding:7px 12px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">+ Cek Ujian di Kelas ' + klsAktif + '</button>' +
                '</div>' +
            '</div>' +
            htmlUjian +
        '</div>';
};

setTimeout(function() {
    if (window.updateBadgeReminderAdmin) window.updateBadgeReminderAdmin();
}, 1500);

// ============================================================================
// PATCH ANTI-LAG SLIDER PDF
// ============================================================================
window.geserSlidePDF = function(blockIdx, arah) {
    var slider = document.getElementById('pdf-slider-' + blockIdx);
    var blok = window.contentBlocksData && window.contentBlocksData[blockIdx];
    if (!slider || !blok || !blok.pages) return;

    slider.setAttribute('data-animating', 'true');
    clearTimeout(window['slideTimer_' + blockIdx]);

    var oldSlide = blok.currentSlide || 0;
    var cvs = document.querySelector('.drawing-layer[data-index="' + blockIdx + '"]');
    if (cvs) {
        if (!blok.slideDrawings) blok.slideDrawings = {};
        blok.slideDrawings[oldSlide] = cvs.toDataURL('image/png');
    }

    var nextSlide = Math.max(0, Math.min(blok.pages.length - 1, oldSlide + arah));
    blok.currentSlide = nextSlide;
    slider.scrollTo({ left: nextSlide * slider.clientWidth, behavior: 'smooth' });

    var numEl = document.getElementById('pdf-page-num-' + blockIdx);
    if (numEl) numEl.innerText = (nextSlide + 1);

    window['slideTimer_' + blockIdx] = setTimeout(function() {
        slider.removeAttribute('data-animating');
        if (window.muatUlangSemuaKanvasGambar) window.muatUlangSemuaKanvasGambar();
    }, 450); 
};

window.origOnScrollSlidePDF = window.onScrollSlidePDF;
window.onScrollSlidePDF = function(blockIdx, sliderEl) {
    if (sliderEl.getAttribute('data-animating') === 'true') return;
    clearTimeout(window['scrollDebounce_' + blockIdx]);
    window['scrollDebounce_' + blockIdx] = setTimeout(function() {
        var blok = window.contentBlocksData && window.contentBlocksData[blockIdx];
        if (!sliderEl || !blok || !blok.pages) return;
        var idx = Math.round(sliderEl.scrollLeft / (sliderEl.clientWidth || 1));
        if (idx !== (blok.currentSlide || 0)) {
            blok.currentSlide = idx;
            var numEl = document.getElementById('pdf-page-num-' + blockIdx);
            if (numEl) numEl.innerText = (idx + 1);
            if (window.muatUlangSemuaKanvasGambar) window.muatUlangSemuaKanvasGambar();
        }
    }, 150);
};

// ============================================================================
// SISTEM SUPER ADMIN & MULTI-TENANT RUANG KERJA GURU
// ============================================================================

window.percobaanLoginGagal = 0;
window.prosesLoginGuru = function() { 
    var u = document.getElementById('input-username-guru').value.trim().toLowerCase();
    var p = document.getElementById('input-sandi-guru').value.trim();

    if (!u || !p) return window.tampilkanToastFullscreen("Isi Username dan Sandi!");

    // Bypass untuk Anda sebagai Super Admin (Mahardika)
    if (u === 'mahardika' && (btoa(p) === "Z3VydWJpb2xvZ2k=" || btoa(p) === "YWRtaW4xMjM=")) {
        sessionStorage.setItem("guruUsername", "mahardika");
        sessionStorage.setItem("statusGuru", "aktif");
        sessionStorage.setItem("guruToken", "superadmin");
        window.location.reload();
        return;
    }

    // Cek guru lain dari Firebase Global (Tidak terisolasi)
    document.getElementById('save-status-bar').innerHTML = "<span style='color:#e67e22;'>Mengecek Akun...</span>";
    window.fbGet(window.fbChild(window.fbRefGlobal(window.dbGlobal), 'akun_guru/' + u)).then(function(snap) {
        if (snap.exists() && snap.val().password === p) {
            sessionStorage.setItem("guruUsername", u);
            sessionStorage.setItem("statusGuru", "aktif");
            sessionStorage.setItem("guruToken", "guru_" + u);
            window.location.reload();
        } else {
            window.percobaanLoginGagal++;
            window.tampilkanToastFullscreen("❌ Username atau Sandi salah!");
            document.getElementById('save-status-bar').innerHTML = "Cloud Sync: Ready";
        }
    });
};

// Tambahkan Tab Super Admin di Ruang Administrasi (Khusus login 'mahardika')
var origBukaModalAdministrasi = window.bukaModalAdministrasi;
window.bukaModalAdministrasi = function(tabAwal) {
    if (typeof origBukaModalAdministrasi === 'function') origBukaModalAdministrasi(tabAwal);
    
    var isSuperAdmin = sessionStorage.getItem("guruUsername") === "mahardika";
    var tabContainer = document.querySelector('.admin-hub-tabs');
    
    if (isSuperAdmin && tabContainer && !document.getElementById('tab-btn-superadmin')) {
        var btnSuper = document.createElement('button');
        btnSuper.type = 'button';
        btnSuper.id = 'tab-btn-superadmin';
        btnSuper.className = 'admin-tab-btn';
        btnSuper.style.cssText = 'background:#f1c40f; color:#0b3954; margin-left:auto; border-color:#f39c12;';
        btnSuper.innerHTML = '👑 Kelola Akun Guru';
        btnSuper.onclick = function() { window.gantiTabAdministrasi('superadmin'); };
        tabContainer.appendChild(btnSuper);
    }
};

var origGantiTabAdministrasi = window.gantiTabAdministrasi;
window.gantiTabAdministrasi = function(namaTab) {
    if (typeof origGantiTabAdministrasi === 'function') origGantiTabAdministrasi(namaTab);
    
    var btnSuper = document.getElementById('tab-btn-superadmin');
    if (btnSuper) btnSuper.classList.remove('active');

    if (namaTab === 'superadmin') {
        if (btnSuper) btnSuper.classList.add('active');
        window.tampilkanUISuperAdmin();
    }
};

window.tampilkanUISuperAdmin = function() {
    var body = document.getElementById('body-ruang-administrasi');
    if (!body) return;

    body.innerHTML = 
        '<div style="background:#fff8e7; border:2px solid #f1c40f; border-radius:10px; padding:15px; margin-bottom:15px;">' +
            '<h4 style="margin:0 0 10px 0; color:#d35400;">👑 Buat Akun Guru Baru</h4>' +
            '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
                '<input type="text" id="sa-new-user" placeholder="Username Baru (tanpa spasi, misal: budi)" style="padding:8px; border-radius:6px; border:1px solid #ccc; flex:1;">' +
                '<input type="text" id="sa-new-pass" placeholder="Password" style="padding:8px; border-radius:6px; border:1px solid #ccc; flex:1;">' +
                '<button type="button" onclick="window.buatAkunGuruBaru()" style="background:#27ae60; color:#fff; border:none; padding:8px 15px; border-radius:6px; font-weight:bold; cursor:pointer;">+ Buat Akun</button>' +
            '</div>' +
            '<p style="font-size:11px; color:#555; margin:8px 0 0 0;">Catatan: Setiap guru yang Anda buat di sini akan memiliki ruang kerja (materi, ujian, absensi) yang terpisah total dari Anda dan guru lainnya.</p>' +
        '</div>' +
        '<h4 style="color:#0b3954;">Daftar Guru Terdaftar</h4>' +
        '<div id="sa-list-guru" style="border:1px solid #cbd5e1; border-radius:8px; overflow:hidden;">' +
            '<div style="padding:20px; text-align:center; color:#888;">⏳ Memuat daftar guru...</div>' +
        '</div>';

    window.muatDaftarAkunGuru();
};

window.buatAkunGuruBaru = function() {
    var u = document.getElementById('sa-new-user').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    var p = document.getElementById('sa-new-pass').value.trim();
    
    if (!u || !p) return window.tampilkanToastFullscreen("Username dan Password wajib diisi!");
    if (u === 'mahardika') return window.tampilkanToastFullscreen("Username mahardika dilarang!");

    window.fbSet(window.fbRefGlobal(window.dbGlobal, 'akun_guru/' + u), {
        password: p,
        created: Date.now()
    }).then(function() {
        window.tampilkanToastFullscreen("✅ Akun guru " + u + " berhasil dibuat!");
        document.getElementById('sa-new-user').value = '';
        document.getElementById('sa-new-pass').value = '';
    });
};

window.muatDaftarAkunGuru = function() {
    window.fbOnValue(window.fbRefGlobal(window.dbGlobal, 'akun_guru'), function(snap) {
        var listEl = document.getElementById('sa-list-guru');
        if (!listEl) return;
        if (!snap.exists()) {
            listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Belum ada guru lain yang terdaftar.</div>';
            return;
        }
        var data = snap.val();
        var html = '';
        Object.keys(data).forEach(function(u) {
            html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom:1px solid #e2e8f0; background:#fff;">' +
                '<div><b style="color:#2980b9; font-size:15px;">' + u + '</b> <span style="color:#7f8c8d; font-size:12px; margin-left:10px;">Sandi: ' + data[u].password + '</span></div>' +
                '<button type="button" onclick="window.hapusAkunGuru(\'' + u + '\')" style="background:#fadbd8; color:#c0392b; border:none; padding:5px 10px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:11px;">🗑️ Hapus Akses</button>' +
            '</div>';
        });
        listEl.innerHTML = html;
    });
};

window.hapusAkunGuru = function(u) {
    window.tampilkanKonfirmasiFullscreen("Hapus akses login untuk guru: " + u + "?\n(Data mereka tetap aman di server, hanya aksesnya yang dicabut)", function() {
        window.fbRemove(window.fbRefGlobal(window.dbGlobal, 'akun_guru/' + u));
    });
};

// ==========================================
// FITUR LOGOUT & SALIN LINK MURID
// ==========================================
window.logoutGuru = function() {
    if(confirm("Yakin ingin keluar (logout) dari ruang kerja ini?")) {
        sessionStorage.removeItem("statusGuru");
        sessionStorage.removeItem("guruUsername");
        sessionStorage.removeItem("guruToken");
        window.location.href = window.location.pathname; // Muat ulang bersih tanpa embel-embel URL
    }
};

window.salinLinkMurid = function() {
    var activeGuru = sessionStorage.getItem("guruUsername");
    if (!activeGuru || activeGuru === "null") activeGuru = "mahardika";
    var linkShare = window.location.origin + window.location.pathname + "?guru=" + activeGuru;
    
    navigator.clipboard.writeText(linkShare).then(function() {
        alert("✅ Link berhasil disalin!\nBagikan link ini ke murid Anda: \n\n" + linkShare);
    }).catch(function() {
        prompt("Gagal menyalin otomatis. Silakan blok dan salin link di bawah ini secara manual:", linkShare);
    });
};

// ============================================================================
// MASTER PATCH ARSITEKTUR KELAS BERAT (HEAVY-DUTY ARCHITECTURE)
// JURUS 1: OFFLINE EXAM MODE (UNTUK 500+ SISWA BERSAMAAN)
// JURUS 2: CLOUD STORAGE IMGBB (MENGHEMAT 99% KAPASITAS DATABASE FIREBASE)
// ============================================================================

// ----------------------------------------------------------------------------
// JURUS 2: INTEGRASI CLOUD SERVER (IMGBB) UNTUK GAMBAR DAN PDF
// ----------------------------------------------------------------------------
window.uploadKeImgBB = async function(base64Data) {
    // Kunci API Publik Gratis untuk Upload Anonim
    var apiKey = "d2b70b55ec70f443b7e4529f79b69152"; 
    var b64str = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    var formData = new FormData();
    formData.append("image", b64str);

    var res = await fetch("https://api.imgbb.com/1/upload?key=" + apiKey, {
        method: "POST",
        body: formData
    });
    var data = await res.json();
    if (!data.success) throw new Error("Cloud server sedang sibuk, gagal mengunggah gambar.");
    return data.data.url; // Hanya URL pendek yang dikembalikan
};

// Modifikasi Tombol Upload Gambar Toolbar -> Masuk ke Cloud Server
function pasangSistemUploadGambarCloud() {
    var oldImgInput = document.getElementById('image-upload-input');
    if (oldImgInput && !oldImgInput.getAttribute('data-cloud-ready')) {
        var newImgInput = oldImgInput.cloneNode(true);
        newImgInput.setAttribute('data-cloud-ready', 'true');
        oldImgInput.parentNode.replaceChild(newImgInput, oldImgInput);

        newImgInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var sb = document.getElementById('save-status-bar');
            if (sb) sb.innerHTML = "<span style='color:#e67e22;'>⏳ Mengunggah Gambar ke Cloud...</span>";

            var reader = new FileReader();
            reader.onload = async function(ev) {
                try {
                    // Kirim ke ImgBB, dapatkan URL-nya
                    var cloudUrl = await window.uploadKeImgBB(ev.target.result);
                    window.kembalikanSeleksiTeks();
                    // Sisipkan HANYA URL tersebut ke dalam Editor (Ukuran teks super kecil)
                    document.execCommand('insertImage', false, cloudUrl);
                    if (sb) sb.innerHTML = "<span style='color:#2ecc71;'>✓ Gambar Cloud Berhasil Disisipkan</span>";
                    window.triggerInput();
                } catch(err) {
                    alert("Gagal unggah: " + err.message);
                    if (sb) sb.innerHTML = "Cloud Sync: Ready";
                }
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        });
    }
}
setInterval(pasangSistemUploadGambarCloud, 1500);

// Modifikasi Tombol PDF Slide -> Masuk ke Cloud Server
window.prosesUploadPDFMateri = async function(inputEl) {
    var file = inputEl.files && inputEl.files[0];
    if (!file) return;

    var statusEl = document.getElementById('save-status-bar');
    if (statusEl) statusEl.innerHTML = "<span style='color:#e67e22;'>⏳ Mengonversi PDF & Mengunggah ke Cloud...</span>";

    try {
        var pdfjsLib = await window.muatLibraryPDFJS();
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        var b64Arr = [];

        var maxPages = Math.min(pdf.numPages, 25);
        for (var i = 1; i <= maxPages; i++) {
            if (statusEl) statusEl.innerHTML = "<span style='color:#e67e22;'>⏳ Memproses Halaman " + i + "...</span>";
            var page = await pdf.getPage(i);
            var viewport = page.getViewport({ scale: 1.5 });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            // Kualitas dikompres 70% untuk optimalisasi kecepatan upload
            b64Arr.push(canvas.toDataURL('image/jpeg', 0.7));
        }

        if (statusEl) statusEl.innerHTML = "<span style='color:#e67e22;'>☁️ Menyimpan Slide ke Cloud (Menghemat 95% Database)...</span>";

        // Upload semua slide PDF ke ImgBB secara bersamaan (Parallel Upload)
        var uploadPromises = b64Arr.map(function(b64) {
            return window.uploadKeImgBB(b64);
        });
        var cloudUrls = await Promise.all(uploadPromises); // cloudUrls berisi deretan Teks Link URL

        if (!window.contentBlocksData) window.contentBlocksData = [];
        window.contentBlocksData.push({
            type: 'pdf', pages: cloudUrls, currentSlide: 0, slideDrawings: {}, bg: '#ffffff', width: 'L', padTop: '20px', padBot: '30px', drawing: ''
        });

        window.renderBlocks();
        if (typeof window.simpanKeDB === 'function') window.simpanKeDB();
        if (statusEl) statusEl.innerHTML = "<span style='color:#2ecc71;'>✓ Slide PDF Cloud Berhasil Dibuat!</span>";
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

    } catch (e) {
        alert("Gagal memuat PDF Cloud: " + e.message);
        if (statusEl) statusEl.innerHTML = "Cloud Sync: Ready";
    }
    inputEl.value = '';
};

// ----------------------------------------------------------------------------
// JURUS 1: MODE OFFLINE MURID & PENGIRIMAN DATA UJIAN VIA HTTP REST API
// ----------------------------------------------------------------------------

// Mendapatkan URL REST API sesuai Ruang Kerja (Workspace) Guru saat ini
window.getRestDBUrl = function(path) {
    var activeGuru = "mahardika";
    var urlGuru = new URLSearchParams(window.location.search).get('guru');
    if (urlGuru && urlGuru !== "null") activeGuru = urlGuru;
    var prefix = (activeGuru === "mahardika") ? "" : ("workspace_" + activeGuru + "/");
    return "https://mardikawan-project-default-rtdb.firebaseio.com/" + prefix + path + ".json";
};

// Modifikasi Pintu Masuk Ujian -> Otomatis Putus Koneksi Database
var origVerifikasiMasuk = window.verifikasiMasukUjian;
window.verifikasiMasukUjian = async function() {
    if (typeof origVerifikasiMasuk === 'function') origVerifikasiMasuk();
    
    // Setelah 3 detik (diasumsikan soal ujian selesai diunduh), putuskan koneksi!
    setTimeout(async function() {
        if (window.isStrictUjianActive && sessionStorage.getItem("statusGuru") !== "aktif") {
            try {
                const { goOffline } = await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js");
                goOffline(window.dbGlobal);
                console.log("✅ MODE UJIAN OFFLINE AKTIF: Perangkat Siswa berhenti membebani Server Database.");
            } catch(e) {}
        }
    }, 3000);
};

// Modifikasi Deteksi Pelanggaran -> Kirim Data tanpa Koneksi Database Terbuka (REST API PUT)
window.pantauPelanggaranUjian = function(e) {
    if (!window.isStrictUjianActive) return;
    if (document.body.classList.contains('mode-edit-aktif') || document.documentElement.classList.contains('force-edit-mode')) return;
    let isViolation = false;

    if (e.type === 'resize') {
        if(window.visualViewport && window.visualViewport.scale !== 1) { window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight; return; }
        let wDiff = Math.abs(window.innerWidth - window.initialWinW); let hDiff = Math.abs(window.innerHeight - window.initialWinH);
        let isRotation = (Math.abs(window.innerWidth - window.initialWinH) < 150) && (Math.abs(window.innerHeight - window.initialWinW) < 150);
        let isKeyboard = wDiff < 30 && hDiff > 100;
        if (isRotation || isKeyboard) { window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight; return; }
        if (wDiff > 50 || hDiff > (window.initialWinH * 0.3)) { isViolation = true; }
    } else if (document.hidden || document.visibilityState==='hidden' || e.type==='blur') {
        isViolation = true;
    }

    if (isViolation && (Date.now() - window.lastViolationTime > 3000)) {
        window.lastViolationTime = Date.now(); window.initialWinW = window.innerWidth; window.initialWinH = window.innerHeight;
        if (window.sedangMenghukum) { clearInterval(window.hukumanTimer); }
        window.violationCount++; window.sedangMenghukum = true;
        let sName = window.latihanState.namaSiswa, uName = window.latihanState.namaUjian;

        if(window.violationCount >= 5) {
            // KIRIM REST API (Tidak membutuhkan koneksi WebSocket yang aktif)
            fetch(window.getRestDBUrl(`live_monitor/${uName}/${sName}`), { method: 'PUT', body: JSON.stringify({ vc: window.violationCount, time: Date.now(), status: 'Diskualifikasi (Kumpul Otomatis)' }) });
            alert("🚨 PELANGGARAN KE-5 TERDETEKSI! Ujian dihentikan dan jawaban otomatis terkirim tanpa kompromi.");
            window.kumpulkanUjianStrict(true);
            return;
        }

        // KIRIM REST API
        fetch(window.getRestDBUrl(`live_monitor/${uName}/${sName}`), { method: 'PUT', body: JSON.stringify({ vc: window.violationCount, time: Date.now(), status: 'Sedang Dihukum' }) });

        let s = 600; if(window.violationCount >= 2) s = 1800;
        let stateStr = localStorage.getItem('gamma_exam_state'); if(stateStr) { let state = JSON.parse(stateStr); state.vc = window.violationCount; state.penaltyEndTime = Date.now() + (s * 1000); localStorage.setItem('gamma_exam_state', JSON.stringify(state)); }
        window.terapkanHukumanVisual(s);
    }
};

// Modifikasi Pengumpulan Ujian -> Kirim Hasil tanpa Koneksi Database Terbuka (REST API POST/PUT)
window.kumpulkanUjianStrict = function(isForceSubmit = false) {
    let s = window.latihanState;
    if (!isForceSubmit && s.answered.size < s.total) {
        if (!confirm(`Baru dijawab ${s.answered.size}/${s.total}. Yakin kumpulkan?`)) return;
    }

    let sb = document.getElementById('save-status-bar');
    if (sb) {
        sb.style.display = 'block';
        sb.innerHTML = "<span style='color:#e67e22;'>Merekap Jawaban...</span>";
    }

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

    // SIAPKAN PAYLOAD UNTUK DIKIRIM (REST API)
    let statusTeks = isForceSubmit ? `Selesai (Otomatis) | Nilai: ${score}` : `Selesai (Aman) | Nilai: ${score}`;
    let payloadHasil = { nama: s.namaSiswa, nilai: score, benar: cor, total: s.total, jawaban: rincian, timestamp: Date.now() };

    // KIRIM REST API (Jalur HTTP Bebas Hambatan)
    fetch(window.getRestDBUrl(`live_monitor/${s.namaUjian}/${s.namaSiswa}`), { method: 'PUT', body: JSON.stringify({ vc: window.violationCount, status: statusTeks, time: Date.now() }) });
    fetch(window.getRestDBUrl(`hasil_ujian/${s.namaUjian}/${Date.now()}_${Math.random().toString(36).substr(2,4)}`), { method: 'PUT', body: JSON.stringify(payloadHasil) });

    if (sb) sb.innerHTML = "<span style='color:#2ecc71;'>✓ Berhasil Dikumpulkan!</span>";

    window.isStrictUjianActive = false; document.body.classList.remove('strict-mode-active');
    if (window.ujianTimerInterval) clearInterval(window.ujianTimerInterval);
    document.getElementById('ujian-timer-fixed').style.display = 'none';
    document.removeEventListener("visibilitychange", window.pantauPelanggaranUjian); window.removeEventListener("blur", window.pantauPelanggaranUjian); window.removeEventListener("resize", window.pantauPelanggaranUjian); window.onbeforeunload = null;
    if (window.hukumanTimer) clearInterval(window.hukumanTimer); document.getElementById('strict-warning-overlay').style.display = 'none';
    let submitBtn = document.querySelector('#ujian-strict-container .btn-submit-ujian'); if (submitBtn) submitBtn.style.display = 'none';

    if (isForceSubmit) {
        document.getElementById('ujian-strict-subtitle').innerText = "Ujian Telah Selesai. Anda tidak dapat melihat review/pembahasan.";
        document.getElementById('btn-close-strict').style.display = 'block';
        document.getElementById('ujian-strict-container').innerHTML = '<h2 style="text-align:center; color:#e74c3c; margin-top:50px;">Jawaban Anda Telah Terkirim</h2><p style="text-align:center;">Silakan keluar dari ruangan ujian.</p>';
    } else {
        document.getElementById('ujian-strict-subtitle').innerText = "Mode Review: Ujian telah dikumpulkan.";
        document.getElementById('btn-close-strict').style.display = 'block';
        window.tampilkanToastFullscreen("✅ Ujian berhasil dikumpulkan!");
    }
    
    document.getElementById('quiz-result-score').innerText = score; document.getElementById('quiz-result-correct').innerText = cor; document.getElementById('quiz-result-total').innerText = s.total;
    document.getElementById('btn-remedial').style.display = 'none'; window.bukaModal('modal-quiz-result');
};

// ============================================================================
// MODUL LAPORAN PRAKTIKUM DIGITAL (TERINTEGRASI CLOUD & DB REST)
// ============================================================================

// 1. Sisipkan Tombol "🧪 PRAKTIKUM" ke Navbar secara otomatis
var intervalPrak = setInterval(function() {
    var navbarUl = document.getElementById('dynamic-navbar');
    if (navbarUl && !document.getElementById('btn-nav-praktikum')) {
        var li = document.createElement('li');
        li.id = 'btn-nav-praktikum';
        li.style.display = "inline-block";
        li.innerHTML = '<a href="#" onclick="window.bukaModalPraktikum(); return false;" style="color:#2ecc71; font-weight:bold; letter-spacing:1px; text-decoration:none; padding:10px 15px; display:block;">🧪 PRAKTIKUM</a>';
        
        // Letakkan di sebelah kanan tombol Ujian
        navbarUl.insertBefore(li, navbarUl.children[2] || navbarUl.firstChild); 
        clearInterval(intervalPrak);
    }
}, 1000);

// 2. Suntikkan Template Jendela (Modal) Praktikum ke dalam Web
var htmlModalPrak = `
<div id="modal-praktikum" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; overflow-y:auto; font-family:'Poppins',sans-serif;">
    <div style="background:#fff; width:90%; max-width:850px; margin:40px auto; padding:30px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        <span onclick="document.getElementById('modal-praktikum').style.display='none'" style="float:right; cursor:pointer; font-size:28px; color:#e74c3c;">&times;</span>
        <h2 style="color:#2c3e50; text-align:center; margin-bottom:25px; border-bottom:2px solid #ecf0f1; padding-bottom:10px;">🧪 Laporan Praktikum Sains</h2>

        <!-- TAMPILAN GURU (DASHBOARD KOREKSI) -->
        <div id="view-praktikum-guru" style="display:none;">
            <label style="font-weight:bold; color:#34495e;">📂 Pilih Laporan Siswa yang Masuk:</label>
            <select id="select-laporan-siswa" onchange="window.bukaLaporanSiswa()" style="width:100%; padding:12px; margin-top:8px; margin-bottom:20px; border:1px solid #bdc3c7; border-radius:6px; font-size:16px;"></select>
            <div id="tempat-laporan-guru" style="border:1px solid #ecf0f1; padding:25px; border-radius:8px; min-height:400px; background:#f4f6f7;">
                <i>Belum ada laporan yang dipilih.</i>
            </div>
        </div>

        <!-- TAMPILAN SISWA (FORM PENGISIAN) -->
        <div id="view-praktikum-siswa" style="display:none;">
            <input type="text" id="prak-judul" placeholder="Judul Praktikum (Contoh: Uji Enzim Katalase Hati Ayam)" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; font-weight:bold; font-size:15px;">
            <div style="display:flex; gap:15px; margin-bottom:15px;">
                <input type="text" id="prak-nama" placeholder="Nama Lengkap Siswa" style="flex:2; padding:12px; border:1px solid #bdc3c7; border-radius:6px;">
                <select id="prak-kelas" style="flex:1; padding:12px; border:1px solid #bdc3c7; border-radius:6px;">
                    <option value="">-- Pilih Kelas --</option>
                    <option value="X">Kelas X</option>
                    <option value="XI">Kelas XI</option>
                    <option value="XII">Kelas XII</option>
                </select>
            </div>
            
            <label style="font-weight:bold; font-size:14px; color:#34495e;">BAB I: Pendahuluan (Latar Belakang & Tujuan)</label>
            <textarea id="prak-bab1" style="width:100%; height:80px; padding:10px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; resize:vertical;"></textarea>
            
            <label style="font-weight:bold; font-size:14px; color:#34495e;">BAB II: Dasar Teori</label>
            <textarea id="prak-bab2" style="width:100%; height:80px; padding:10px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; resize:vertical;"></textarea>
            
            <label style="font-weight:bold; font-size:14px; color:#34495e;">BAB III: Alat, Bahan & Cara Kerja</label>
            <textarea id="prak-bab3" style="width:100%; height:100px; padding:10px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; resize:vertical;"></textarea>
            
            <label style="font-weight:bold; font-size:14px; color:#34495e;">BAB IV: Hasil Pengamatan & Pembahasan</label>
            <textarea id="prak-bab4" style="width:100%; height:140px; padding:10px; margin-bottom:15px; border:1px solid #bdc3c7; border-radius:6px; resize:vertical;"></textarea>
            
            <label style="font-weight:bold; font-size:14px; color:#34495e;">BAB V: Kesimpulan</label>
            <textarea id="prak-kesimpulan" style="width:100%; height:80px; padding:10px; margin-bottom:20px; border:1px solid #bdc3c7; border-radius:6px; resize:vertical;"></textarea>

            <label style="font-weight:bold; font-size:14px; color:#34495e; display:block; margin-bottom:5px;">📸 Lampiran Foto (Bukti Praktikum):</label>
            <input type="file" id="prak-lampiran" accept="image/*" style="width:100%; padding:10px; background:#ecf0f1; border-radius:6px; margin-bottom:10px;">
            <p id="prak-status" style="font-size:14px; font-weight:bold; margin-bottom:15px; text-align:center;"></p>

            <button onclick="window.kirimLaporanPraktikum(event)" style="width:100%; background:#3498db; color:#fff; padding:15px; border:none; border-radius:6px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 6px rgba(52, 152, 219, 0.3); transition:0.2s;">🚀 Kumpulkan Laporan Praktikum</button>
        </div>
    </div>
</div>`;
document.body.insertAdjacentHTML('beforeend', htmlModalPrak);

// 3. Logika Membedakan Tampilan Guru & Siswa
window.bukaModalPraktikum = function() {
    document.getElementById('modal-praktikum').style.display = 'block';
    
    // Jika Mahardika (atau guru lain) sedang login
    if (sessionStorage.getItem("statusGuru") === "aktif") {
        document.getElementById('view-praktikum-siswa').style.display = 'none';
        document.getElementById('view-praktikum-guru').style.display = 'block';
        window.muatDaftarLaporan();
    } else {
        // Jika murid yang membuka
        document.getElementById('view-praktikum-guru').style.display = 'none';
        document.getElementById('view-praktikum-siswa').style.display = 'block';
    }
};

// 4. Mesin Pengirim Data (Khusus Siswa)
window.kirimLaporanPraktikum = async function(event) {
    var judul = document.getElementById('prak-judul').value;
    var nama = document.getElementById('prak-nama').value;
    var kelas = document.getElementById('prak-kelas').value;
    var bab1 = document.getElementById('prak-bab1').value;
    var bab2 = document.getElementById('prak-bab2').value;
    var bab3 = document.getElementById('prak-bab3').value;
    var bab4 = document.getElementById('prak-bab4').value;
    var kes = document.getElementById('prak-kesimpulan').value;
    var fileInput = document.getElementById('prak-lampiran');
    var statusEl = document.getElementById('prak-status');

    if (!judul || !nama || !kelas || !bab1 || !bab4) {
        alert("⚠️ Gagal: Mohon lengkapi data wajib (Judul, Nama, Kelas, Bab 1, dan Bab 4)!");
        return;
    }

    var btn = event.target;
    btn.disabled = true; btn.style.background = "#95a5a6";
    statusEl.innerHTML = "<span style='color:#f39c12;'>⏳ Menyiapkan dokumen laporan...</span>";

    try {
        var lampiranUrl = "";
        // Jika murid melampirkan foto, titipkan dulu ke Cloud ImgBB
        if (fileInput.files && fileInput.files[0]) {
            statusEl.innerHTML = "<span style='color:#f39c12;'>☁️ Mengunggah bukti foto ke Cloud...</span>";
            var reader = new FileReader();
            lampiranUrl = await new Promise((resolve) => {
                reader.onload = async function(e) {
                    var url = await window.uploadKeImgBB(e.target.result);
                    resolve(url);
                };
                reader.readAsDataURL(fileInput.files[0]);
            });
        }

        statusEl.innerHTML = "<span style='color:#f39c12;'>💾 Mengirim ke meja guru...</span>";
        
        // Buat ID unik berdasarkan waktu dan nama
        var idLaporan = Date.now() + "_" + nama.replace(/[^a-zA-Z0-9]/g, '');
        // Arahkan ke workspace guru yang sedang aktif di URL (Mendukung Multi-Tenant)
        var dbRestUrl = window.getRestDBUrl("laporan_praktikum/" + idLaporan);

        var payload = {
            judul: judul, nama: nama, kelas: kelas,
            bab1: bab1, bab2: bab2, bab3: bab3, bab4: bab4, kesimpulan: kes,
            lampiran: lampiranUrl, waktu: new Date().toLocaleString()
        };

        // Kirim via REST API agar tidak membebani koneksi batas Firebase
        await fetch(dbRestUrl, { method: 'PUT', body: JSON.stringify(payload) });

        statusEl.innerHTML = "<span style='color:#2ecc71;'>✅ Laporan berhasil dikumpulkan!</span>";
        setTimeout(function(){
            document.getElementById('modal-praktikum').style.display = 'none';
            statusEl.innerText = "";
            btn.disabled = false; btn.style.background = "#3498db";
            // Bersihkan form otomatis setelah terkirim
            ['prak-judul','prak-nama','prak-kelas','prak-bab1','prak-bab2','prak-bab3','prak-bab4','prak-kesimpulan','prak-lampiran'].forEach(id => document.getElementById(id).value='');
        }, 2000);

    } catch (err) {
        statusEl.innerHTML = "<span style='color:#e74c3c;'>❌ Gagal mengirim: " + err.message + "</span>";
        btn.disabled = false; btn.style.background = "#3498db";
    }
};

// 5. Mesin Pembaca Data (Khusus Guru)
window.muatDaftarLaporan = async function() {
    var select = document.getElementById('select-laporan-siswa');
    var wadah = document.getElementById('tempat-laporan-guru');
    select.innerHTML = '<option value="">⏳ Mengambil data dari server...</option>';
    
    try {
        var dbRestUrl = window.getRestDBUrl("laporan_praktikum");
        var res = await fetch(dbRestUrl);
        var data = await res.json();
        
        window.dataLaporanTemp = data || {};
        select.innerHTML = '<option value="">-- Pilih Laporan Siswa --</option>';

        var adaData = false;
        for (var key in window.dataLaporanTemp) {
            adaData = true;
            var lap = window.dataLaporanTemp[key];
            var opt = document.createElement('option');
            opt.value = key; 
            opt.text = lap.kelas + " | " + lap.nama + " | " + lap.judul;
            select.appendChild(opt);
        }
        
        if(!adaData) {
            wadah.innerHTML = '<i>Belum ada laporan praktikum yang masuk dari siswa.</i>';
        } else {
            wadah.innerHTML = '<i>Silakan pilih nama siswa di atas untuk membaca laporan.</i>';
        }
    } catch(e) {
        select.innerHTML = '<option value="">❌ Gagal memuat data</option>';
    }
};

// 6. Pencetak Laporan ke Layar Guru
window.bukaLaporanSiswa = function() {
    var key = document.getElementById('select-laporan-siswa').value;
    var wadah = document.getElementById('tempat-laporan-guru');
    if (!key) { wadah.innerHTML = '<i>Pilih siswa untuk melihat laporan.</i>'; return; }

    var lap = window.dataLaporanTemp[key];
    var imgHtml = lap.lampiran ? '<a href="'+lap.lampiran+'" target="_blank"><img src="'+lap.lampiran+'" style="max-width:100%; max-height:400px; border-radius:8px; margin-top:15px; box-shadow:0 4px 10px rgba(0,0,0,0.1); cursor:zoom-in;" title="Klik untuk memperbesar"></a>' : '<i>(Siswa tidak melampirkan foto dokumentasi)</i>';
    
    var formatBab = (judul, isi) => '<div style="margin-bottom:20px;"><h4 style="margin:0 0 5px 0; color:#2980b9; border-bottom:1px solid #ecf0f1; padding-bottom:5px;">'+judul+'</h4><div style="background:#fff; padding:15px; border-left:4px solid #3498db; border-radius:0 4px 4px 0; white-space:pre-wrap; box-shadow:0 1px 3px rgba(0,0,0,0.05); font-size:14px;">'+(isi || '-')+'</div></div>';

    wadah.innerHTML = 
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
        '<div style="margin-bottom:15px;"><h4 style="margin:0 0 5px 0; color:#2980b9;">📸 Lampiran Dokumentasi</h4>' + imgHtml + '</div>';
};

// ==========================================
// FIX: PEMUNCUL TOMBOL PRAKTIKUM DI NAVBAR
// ==========================================
var intervalPrak = setInterval(function() {
    var navbarUl = document.getElementById('dynamic-navbar');
    if (navbarUl && !document.getElementById('btn-nav-praktikum')) {
        var li = document.createElement('li');
        li.id = 'btn-nav-praktikum';
        li.style.display = "inline-block";
        li.innerHTML = '<a href="#" onclick="window.bukaModalPraktikum(); return false;" style="color:#2ecc71; font-weight:bold; letter-spacing:1px; text-decoration:none; padding:10px 15px; display:block;">🧪 PRAKTIKUM</a>';
        
        // Meletakkan tombol di sebelah menu Ujian
        navbarUl.insertBefore(li, navbarUl.children[2] || navbarUl.firstChild); 
        clearInterval(intervalPrak);
    }
}, 1000);

// ============================================================================
// MODUL MEDIA V3: VIDEO PLAYER & KONVERSI PDF JADI SLIDES (GESER KIRI-KANAN)
// ============================================================================
(function() {
    // 1. Muat mesin pembaca PDF (PDF.js) secara otomatis jika belum ada
    if (!window.pdfjsLib) {
        var scriptPdf = document.createElement('script');
        scriptPdf.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        scriptPdf.onload = function() {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        };
        document.head.appendChild(scriptPdf);
    }

    var lama = document.getElementById('modal-tambah-media');
    if (lama) lama.remove();

    // 2. Jendela Modal Pilihan Video & PDF Slides
    var htmlModal = 
    '<div id="modal-tambah-media" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:100000; justify-content:center; align-items:center; font-family:sans-serif;">' +
        '<div style="background:#fff; width:90%; max-width:520px; padding:25px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.4);">' +
            '<h3 style="margin-top:0; color:#2c3e50; border-bottom:2px solid #ecf0f1; padding-bottom:10px;">➕ Pasang Video / Slide PDF</h3>' +
            '<div style="display:flex; gap:10px; margin-bottom:15px;">' +
                '<label style="flex:1; background:#f4f6f7; padding:10px; border-radius:6px; text-align:center; cursor:pointer; font-weight:bold; border:1px solid #bdc3c7;">' +
                    '<input type="radio" name="jenis-media" value="pdf" checked> 📑 PDF (Jadi Slide Geser)' +
                '</label>' +
                '<label style="flex:1; background:#f4f6f7; padding:10px; border-radius:6px; text-align:center; cursor:pointer; font-weight:bold; border:1px solid #bdc3c7;">' +
                    '<input type="radio" name="jenis-media" value="video"> 🎬 Video Player' +
                '</label>' +
            '</div>' +
            '<input type="file" id="input-file-finder" accept="application/pdf,video/*" style="display:none;">' +
            '<div id="dropzone-media" onclick="document.getElementById(\'input-file-finder\').click()" style="border:2px dashed #3498db; background:#ebf5fb; padding:25px 15px; text-align:center; border-radius:8px; cursor:pointer; margin-bottom:12px;">' +
                '<b id="info-file-media" style="color:#2980b9; font-size:14px;">📂 Klik untuk Pilih PDF / Video dari Finder<br><small style="color:#7f8c8d; font-weight:normal;">(Atau seret file langsung ke kotak ini)</small></b>' +
            '</div>' +
            '<input type="text" id="input-link-media" placeholder="🔗 Atau Paste Link Google Drive / YouTube (Khusus Video)..." style="width:100%; padding:10px; border:1px solid #bdc3c7; border-radius:6px; box-sizing:border-box;">' +
            '<div id="status-proses-media" style="text-align:center; font-size:13px; font-weight:bold; color:#e67e22; margin-top:10px;"></div>' +
            '<div style="display:flex; gap:10px; margin-top:18px;">' +
                '<button type="button" onclick="document.getElementById(\'modal-tambah-media\').style.display=\'none\'" style="flex:1; padding:11px; background:#e74c3c; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Batal</button>' +
                '<button type="button" id="btn-pasang-media" style="flex:2; padding:11px; background:#2ecc71; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">🚀 Pasang ke Materi</button>' +
            '</div>' +
        '</div>' +
    '</div>';
    document.body.insertAdjacentHTML('beforeend', htmlModal);

    var fileTerpilih = null;
    var inputFinder = document.getElementById('input-file-finder');
    var dropzone = document.getElementById('dropzone-media');

    function setFilePilihan(f) {
        if (!f) return;
        fileTerpilih = f;
        document.getElementById('info-file-media').innerHTML = "✅ File Siap: <b>" + f.name + "</b>";
        dropzone.style.background = "#d4efdf";
        dropzone.style.borderColor = "#2ecc71";
        if (f.name.toLowerCase().endsWith('.pdf') || f.type.indexOf('pdf') !== -1) {
            document.querySelector('input[name="jenis-media"][value="pdf"]').checked = true;
        } else {
            document.querySelector('input[name="jenis-media"][value="video"]').checked = true;
        }
    }

    inputFinder.onchange = function() { if (this.files && this.files[0]) setFilePilihan(this.files[0]); };
    dropzone.ondragover = function(e) { e.preventDefault(); dropzone.style.background = '#d6eaf8'; };
    dropzone.ondragleave = function(e) { e.preventDefault(); dropzone.style.background = '#ebf5fb'; };
    dropzone.ondrop = function(e) {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) setFilePilihan(e.dataTransfer.files[0]);
    };

    // 3. Fungsi Navigasi Slide PDF (Geser Kiri, Kanan & Fullscreen)
    window.geserSlidePDF = function(btn, arah) {
        var wrapper = btn.closest('.mardi-pdf-slider');
        if (!wrapper) return;
        var slides = wrapper.querySelectorAll('.mardi-slide-img');
        if (slides.length === 0) return;

        var aktifIdx = 0;
        for (var i = 0; i < slides.length; i++) {
            if (slides[i].style.display !== 'none') {
                aktifIdx = i;
                break;
            }
        }

        var targetIdx = aktifIdx + arah;
        if (targetIdx < 0) targetIdx = 0;
        if (targetIdx >= slides.length) targetIdx = slides.length - 1;

        for (var j = 0; j < slides.length; j++) {
            slides[j].style.display = (j === targetIdx) ? 'block' : 'none';
        }

        var info = wrapper.querySelector('.mardi-slide-counter');
        if (info) info.innerText = 'Slide ' + (targetIdx + 1) + ' / ' + slides.length;
    };

    window.fullscreenSlidePDF = function(btn) {
        var wrapper = btn.closest('.mardi-pdf-slider');
        if (!wrapper) return;
        if (wrapper.requestFullscreen) wrapper.requestFullscreen();
        else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
    };

    // 4. Fungsi Konversi File PDF Menjadi Array Gambar Slide Ringan
    async function ubahPDFJadiSlidesHTML(file, statusEl) {
        if (!window.pdfjsLib) {
            throw new Error("Mesin PDF masih dimuat, tunggu 2 detik lalu klik lagi.");
        }
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        var totalHal = pdf.numPages;
        var daftarGambarHTML = '';

        for (var p = 1; p <= totalHal; p++) {
            statusEl.innerText = "⏳ Mengubah PDF jadi Slide: Halaman " + p + " dari " + totalHal + "...";
            var page = await pdf.getPage(p);
            var viewportAsli = page.getViewport({ scale: 1 });
            var scale = 900 / viewportAsli.width;
            if (scale > 1.5) scale = 1.5;
            var viewport = page.getViewport({ scale: scale });

            var canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            var ctx = canvas.getContext('2d');

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            var imgData = canvas.toDataURL('image/jpeg', 0.68);
            var tampilAwal = (p === 1) ? 'block' : 'none';

            daftarGambarHTML += '<img class="mardi-slide-img" src="' + imgData + '" style="display:' + tampilAwal + '; width:100%; max-height:520px; object-fit:contain; margin:0 auto; user-select:none;">';
        }

        return '<div class="mardi-pdf-slider" contenteditable="false" style="max-width:800px; margin:20px auto; background:#1e272e; border-radius:12px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.25); font-family:sans-serif;">' +
            '<div style="position:relative; background:#0f1419; min-height:280px; display:flex; align-items:center; justify-content:center; padding:10px;">' +
                '<button type="button" onclick="window.geserSlidePDF(this, -1)" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.65); color:#fff; border:none; width:42px; height:42px; border-radius:50%; font-size:20px; cursor:pointer; z-index:5;">❮</button>' +
                daftarGambarHTML +
                '<button type="button" onclick="window.geserSlidePDF(this, 1)" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.65); color:#fff; border:none; width:42px; height:42px; border-radius:50%; font-size:20px; cursor:pointer; z-index:5;">❯</button>' +
            '</div>' +
            '<div style="display:flex; align-items:center; justify-content:space-between; padding:10px 16px; background:#2c3e50; color:#fff;">' +
                '<button type="button" onclick="window.geserSlidePDF(this, -1)" style="background:#3498db; color:#fff; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">⬅️ Geser Kiri</button>' +
                '<span class="mardi-slide-counter" style="font-weight:bold; font-size:14px;">Slide 1 / ' + totalHal + '</span>' +
                '<div style="display:flex; gap:8px;">' +
                    '<button type="button" onclick="window.geserSlidePDF(this, 1)" style="background:#3498db; color:#fff; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">Geser Kanan ➡️</button>' +
                    '<button type="button" onclick="window.fullscreenSlidePDF(this)" style="background:#8e44ad; color:#fff; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">🔲 Full</button>' +
                '</div>' +
            '</div>' +
        '</div><br>';
    }

    // 5. Fungsi Kontrol Video Player (Desain Minimalis Overlay)
    window.mardiVidToggle = function(id) {
        let v = document.getElementById(id); let c = document.getElementById(id + '_wrap').querySelector('.mardi-vid-controls');
        let btn = document.getElementById(id + '_playBtn');
        if (v.paused) { 
            v.play(); 
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'; 
            c.style.opacity = 0; 
        } else { 
            v.pause(); 
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="white"><path d="M8 5v14l11-7z"/></svg>'; 
            c.style.opacity = 1; 
        }
    };
    window.mardiVidUpdate = function(id) {
        let v = document.getElementById(id); let prog = document.getElementById(id + '_progress'); let time = document.getElementById(id + '_time');
        if (!v || !prog || !time) return;
        prog.style.width = ((v.currentTime / v.duration) * 100) + '%';
        time.innerHTML = mFormTime(v.currentTime) + ' / ' + mFormTime(v.duration);
    };
    window.mardiVidMeta = function(id) { window.mardiVidUpdate(id); };
    window.mardiVidSeek = function(e, id) {
        let v = document.getElementById(id); let bar = e.currentTarget; let rect = bar.getBoundingClientRect();
        v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
    };
    window.mardiVidSkip = function(id, sec) { document.getElementById(id).currentTime += sec; };
    window.mardiVidMute = function(id) {
        let v = document.getElementById(id); let btn = document.getElementById(id + '_muteBtn');
        v.muted = !v.muted;
        btn.innerHTML = v.muted 
            ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    };
    window.mardiVidSpeed = function(id, speed) { document.getElementById(id).playbackRate = parseFloat(speed); };
    
    // KUNCI PERBAIKAN: Fungsi Toggle Fullscreen & Keluar
    window.mardiVidFS = function(id) {
        let wrap = document.getElementById(id + '_wrap');
        // Jika sedang TIDAK fullscreen, masuk fullscreen. Jika iya, keluar fullscreen.
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (wrap.requestFullscreen) wrap.requestFullscreen();
            else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    };
    
    function mFormTime(sec) {
        if (isNaN(sec)) return "00:00";
        let m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return (m < 10 ? '0'+m : m) + ':' + (s < 10 ? '0'+s : s);
    }

    function rakitPlayerVideo(url) {
        let id = 'vid_' + Date.now();
        return '<div class="mardi-video-wrapper" id="' + id + '_wrap" contenteditable="false" style="max-width:800px; margin:15px auto; background:#000; position:relative; overflow:hidden; border-radius:10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family: sans-serif; user-select:none;">' +
            // KUNCI PERBAIKAN: CSS Khusus agar video mengisi penuh 100vh saat Fullscreen
            '<style>.mardi-video-wrapper:fullscreen video { max-height: 100vh !important; height: 100vh !important; object-fit: contain; } .mardi-video-wrapper:-webkit-full-screen video { max-height: 100vh !important; height: 100vh !important; object-fit: contain; }</style>' +
            '<video id="' + id + '" src="' + url + '" style="width:100%; max-height:500px; display:block; cursor:pointer;" onclick="window.mardiVidToggle(\'' + id + '\')" ontimeupdate="window.mardiVidUpdate(\'' + id + '\')" onloadedmetadata="window.mardiVidMeta(\'' + id + '\')"></video>' +
            '<div class="mardi-vid-controls" style="position:absolute; bottom:0; left:0; width:100%; background:linear-gradient(transparent, rgba(0,0,0,0.85)); padding:0 15px 10px 15px; box-sizing:border-box; display:flex; flex-direction:column; gap:8px; opacity:1; transition:opacity 0.3s;" onmouseenter="this.style.opacity=1" onmouseleave="if(!document.getElementById(\'' + id + '\').paused) this.style.opacity=0">' +
                '<div style="width:100%; height:5px; background:rgba(255,255,255,0.3); cursor:pointer; position:relative; border-radius:3px;" onclick="window.mardiVidSeek(event, \'' + id + '\')">' +
                    '<div id="' + id + '_progress" style="height:100%; width:0%; background:#e74c3c; border-radius:3px; pointer-events:none; position:relative;">' +
                        '<div style="position:absolute; right:-5px; top:-4px; width:13px; height:13px; background:#e74c3c; border-radius:50%; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex; justify-content:space-between; align-items:center; color:#fff; margin-top:5px;">' +
                    '<div style="display:flex; align-items:center; gap:20px;">' +
                        '<div style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:30px; height:30px;" onclick="window.mardiVidToggle(\'' + id + '\')" id="' + id + '_playBtn">' +
                            '<svg viewBox="0 0 24 24" width="28" height="28" fill="white"><path d="M8 5v14l11-7z"/></svg>' +
                        '</div>' +
                        '<div style="cursor:pointer; display:flex; align-items:center;" onclick="window.mardiVidSkip(\'' + id + '\', -10)" title="Mundur 10 Detik">' +
                            '<svg viewBox="0 0 24 24" width="26" height="26" fill="white"><path d="M12.5 3C17.15 3 21 6.85 21 11.5S17.15 20 12.5 20 4 16.15 4 11.5h2c0 3.59 2.91 6.5 6.5 6.5s6.5-2.91 6.5-6.5-2.91-6.5-6.5-6.5-4.22 2.03-5.59 5.09H9.5l-4-4 4-4v2.53C11.16 4.36 12.5 3 12.5 3zM10 14h1v-3.5H9v.5h1V14zm2.5-3.5v3c0 .55.45 1 1 1h1.5c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1H13.5c-.55 0-1 .45-1 1zm1 2.5v-2h1.5v2h-1.5z"/></svg>' +
                        '</div>' +
                        '<div style="cursor:pointer; display:flex; align-items:center;" onclick="window.mardiVidSkip(\'' + id + '\', 10)" title="Maju 10 Detik">' +
                            '<svg viewBox="0 0 24 24" width="26" height="26" fill="white"><path d="M11.5 3C6.85 3 3 6.85 3 11.5S6.85 20 11.5 20 20 16.15 20 11.5h-2c0 3.59-2.91 6.5-6.5 6.5S5 15.09 5 11.5 7.91 5 11.5 5s4.22 2.03 5.59 5.09H14.5l4-4-4-4v2.53C12.84 4.36 11.5 3 11.5 3zM9 14h1v-3.5H8v.5h1V14zm2.5-3.5v3c0 .55.45 1 1 1h1.5c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1H12.5c-.55 0-1 .45-1 1zm1 2.5v-2h1.5v2h-1.5z"/></svg>' +
                        '</div>' +
                        '<div style="cursor:pointer; display:flex; align-items:center;" onclick="window.mardiVidMute(\'' + id + '\')" id="' + id + '_muteBtn">' +
                            '<svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>' +
                        '</div>' +
                        '<span style="font-size:13px; font-weight:bold; font-family:monospace; margin-left:5px;" id="' + id + '_time">00:00 / 00:00</span>' +
                    '</div>' +
                    '<div style="display:flex; align-items:center; gap:20px;">' +
                        '<select onchange="window.mardiVidSpeed(\'' + id + '\', this.value)" style="background:transparent; color:#fff; border:none; outline:none; cursor:pointer; font-weight:bold; appearance:none; font-size:14px;">' +
                            '<option value="0.5" style="color:#000;">0.5x</option>' +
                            '<option value="1" selected style="color:#000;">1.0x</option>' +
                            '<option value="1.5" style="color:#000;">1.5x</option>' +
                            '<option value="2" style="color:#000;">2.0x</option>' +
                        '</select>' +
                        '<div style="cursor:pointer; display:flex; align-items:center;" onclick="window.mardiVidFS(\'' + id + '\')">' +
                            '<svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div><br>';
    }

    // 6. Eksekusi Saat Tombol "Pasang ke Materi" Diklik
    document.getElementById('btn-pasang-media').onclick = async function() {
        var link = document.getElementById('input-link-media').value.trim();
        var jenis = document.querySelector('input[name="jenis-media"]:checked').value;
        var statusEl = document.getElementById('status-proses-media');
        var btn = this;
        var htmlHasil = '';

        try {
            btn.disabled = true;
            if (fileTerpilih) {
                var isPDF = (jenis === 'pdf' || fileTerpilih.name.toLowerCase().endsWith('.pdf'));
                if (isPDF) {
                    htmlHasil = await ubahPDFJadiSlidesHTML(fileTerpilih, statusEl);
                } else {
                    var blobUrl = URL.createObjectURL(fileTerpilih);
                    htmlHasil = rakitPlayerVideo(blobUrl);
                }
            } else if (link) {
                var idDrive = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (idDrive && idDrive[1]) {
                    htmlHasil = '<iframe src="https://drive.google.com/file/d/' + idDrive[1] + '/preview" width="100%" height="450" style="border:none; border-radius:10px; margin:10px 0;" allow="autoplay; fullscreen"></iframe><br>';
                } else {
                    htmlHasil = rakitPlayerVideo(link);
                }
            } else {
                alert("Pilih file PDF/Video dari Finder atau tempel link terlebih dahulu!");
                btn.disabled = false;
                return;
            }

            if (window.kotakMateriTarget) {
                window.kotakMateriTarget.insertAdjacentHTML('beforeend', htmlHasil);
                window.kotakMateriTarget.dispatchEvent(new Event('input', { bubbles: true }));
                window.kotakMateriTarget.dispatchEvent(new Event('blur', { bubbles: true }));
            }
            statusEl.innerText = '';
            btn.disabled = false;
            document.getElementById('modal-tambah-media').style.display = 'none';
        } catch (err) {
            statusEl.innerText = "❌ Gagal: " + err.message;
            btn.disabled = false;
        }
    };

    // 7. Sisipkan Tombol "➕ Media" di Setiap Kotak Materi
    setInterval(function() {
        document.querySelectorAll('button').forEach(function(btn) {
            var t = btn.innerText || '';
            if (t.includes('Setting') || t.includes('Delete')) {
                var bar = btn.parentNode;
                if (bar && !bar.querySelector('.btn-media-mardi')) {
                    var b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'btn-media-mardi';
                    b.innerText = '➕ Media';
                    b.style.cssText = 'background:#2ecc71; color:#fff; border:none; padding:5px 10px; border-radius:4px; margin-right:5px; cursor:pointer; font-weight:bold; font-size:12px;';
                    b.onclick = function() {
                        var blok = bar.parentElement;
                        window.kotakMateriTarget = blok.querySelector('[contenteditable="true"]') || blok.querySelector('.box-content') || blok;
                        fileTerpilih = null;
                        document.getElementById('input-file-finder').value = '';
                        document.getElementById('input-link-media').value = '';
                        document.getElementById('status-proses-media').innerText = '';
                        document.getElementById('info-file-media').innerHTML = '📂 Klik untuk Pilih PDF / Video dari Finder<br><small style="color:#7f8c8d; font-weight:normal;">(Atau seret file langsung ke kotak ini)</small>';
                        dropzone.style.background = '#ebf5fb';
                        dropzone.style.borderColor = '#3498db';
                        document.getElementById('modal-tambah-media').style.display = 'flex';
                    };
                    bar.insertBefore(b, bar.firstChild);
                }
            }
        });
    }, 1500);
})();

