// public/js/main.js (corrigido: DOM seguro + tema + bottom sheet + modal + tabela)
document.addEventListener("DOMContentLoaded", async () => {
  let user = null;
  let modalAdd = null;
  let currentSheetId = null;
  let sheetState = {}; // temporary values

  // ==================== SESSION ====================
  async function checkSession() {
    const r = await fetch('/api/session').then(r => r.json()).catch(() => ({user:null}));
    user = r.user;
    if (!user) return window.location = '/login.html';

    const tituloEl = document.getElementById('tituloTreino');
    const roleEl = document.getElementById('roleLabel');
    const btnAddEl = document.getElementById('btnAdd');

    if(tituloEl) tituloEl.textContent = user.nomeTreinamento || 'Treinamento';
    if(roleEl) roleEl.textContent = (user.role === 'ADM' ? 'Administrador' : 'Equipe');
    if(btnAddEl) btnAddEl.style.display = (user.role !== 'ADM') ? 'none' : '';
  }

  // ==================== ICON LIBERADO ====================
  function iconLiberado(v) {
    if (!v) v = 'red';
    if (v === 'green') return `<span class="material-symbols-rounded liberado-icon state-green">verified</span>`;
    if (v === 'yellow') return `<span class="material-symbols-rounded liberado-icon state-yellow">schedule</span>`;
    return `<span class="material-symbols-rounded liberado-icon state-red">block</span>`;
  }

  // ==================== CARREGAR TABELA ====================
  async function carregar() {
    const res = await fetch('/api/pessoas');
    if (!res.ok) { console.error('Erro ao buscar pessoas'); return; }
    const lista = await res.json();
    const tbody = document.getElementById('corpoTabela');
    if(!tbody) return;
    tbody.innerHTML = '';

    lista.forEach(p => {
      const tr = document.createElement('tr');

      // --- Nome ---
      const tdNome = document.createElement('td');
      tdNome.innerHTML = `<span class="fw-semibold">${escapeHtml(p.nome)}</span>`;
      if(user.role === 'ADM'){
        tdNome.style.cursor = 'text';
        tdNome.addEventListener('click', () => editarCampo(p.id, 'nome', p.nome, tdNome));
      }
      tr.appendChild(tdNome);

      // --- Teórico ---
      const tdTeorico = document.createElement('td');
      tdTeorico.innerHTML = `<div class="date-badge ${p.teorico ? 'filled':'empty'}">${p.teorico || ''}</div>`;
      if(user.role === 'ADM'){
        tdTeorico.style.cursor = 'pointer';
        tdTeorico.addEventListener('click', () => editarCampo(p.id, 'teorico', p.teorico, tdTeorico, true));
      }
      tr.appendChild(tdTeorico);

      // --- Acomp 1 ---
      const tdA1 = document.createElement('td');
      tdA1.className = 'text-center';
      tdA1.innerHTML = `<div class="date-badge ${p.acomp1 ? 'filled':'empty'}">${p.acomp1 || ''}</div>`;
      tdA1.addEventListener('click', (ev) => {
        if(window.innerWidth >= 880 && user.role === 'ADM'){
          editarCampo(p.id,'acomp1',p.acomp1, tdA1, true); return;
        }
        openSheet(p);
      });
      tr.appendChild(tdA1);

      // --- Acomp 2,3,4 ---
      function cellAcomp(field,val){
        const td = document.createElement('td');
        td.className = 'd-none d-md-table-cell text-center';
        td.innerHTML = `<div class="date-badge ${val?'filled':'empty'}">${val||''}</div>`;
        if(user.role==='ADM'){
          td.style.cursor='pointer';
          td.addEventListener('click',()=>editarCampo(p.id,field,val,td,true));
        }
        return td;
      }
      tr.appendChild(cellAcomp('acomp2',p.acomp2));
      tr.appendChild(cellAcomp('acomp3',p.acomp3));
      tr.appendChild(cellAcomp('acomp4',p.acomp4));

      // --- Liberado ---
      const tdLib = document.createElement('td');
      tdLib.className = 'text-center';
      tdLib.innerHTML = iconLiberado(p.liberado);
      if(user.role==='ADM'){
        tdLib.style.cursor='pointer';
        tdLib.title='Clique para alternar';
        tdLib.addEventListener('click', async(ev)=>{
          ev.stopPropagation();
          const r = await fetch(`/api/pessoas/${p.id}/cicloLiberado`,{method:'PUT'});
          if(r.ok){
            const j = await r.json();
            tdLib.innerHTML = iconLiberado(j.liberado);
          }
        });
      }
      tr.appendChild(tdLib);

      // --- Ações ---
      const tdActions = document.createElement('td');
      tdActions.className = 'text-center';
      tdActions.innerHTML = `<button class="btn btn-sm btn-outline-danger"><span class="material-symbols-rounded">delete</span></button>`;
      const btnDel = tdActions.querySelector('button');
      if(btnDel){
        if(user.role==='ADM'){
          btnDel.addEventListener('click', async(ev)=>{
            ev.stopPropagation();
            if(!confirm('Remover este registro?')) return;
            const r = await fetch(`/api/pessoas/${p.id}`,{method:'DELETE'});
            if(r.ok) carregar(); else alert('Erro ao remover');
          });
        }else{
          btnDel.style.display='none';
        }
      }
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  // ==================== EDITAR CAMPO ====================
  function editarCampo(id,field,value,td,isDate=false){
    td.innerHTML='';
    const input = document.createElement('input');
    input.className='form-control form-control-sm';
    input.type = isDate ? 'date' : 'text';
    input.value = value||'';
    td.appendChild(input);
    input.focus();
    input.select();

    async function salvar(){
      await fetch(`/api/pessoas/${id}`,{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({field,value:input.value||null})
      });
      carregar();
    }
    input.addEventListener('blur',salvar);
    input.addEventListener('keydown',(e)=>{
      if(e.key==='Enter') input.blur();
      if(e.key==='Escape') carregar();
    });
  }

  // ==================== BOTTOM SHEET ====================
  function openSheet(row){
    currentSheetId = row.id;
    sheetState = {
      teorico: row.teorico||'',
      acomp1: row.acomp1||'',
      acomp2: row.acomp2||'',
      acomp3: row.acomp3||'',
      acomp4: row.acomp4||''
    };
    const sheet = document.getElementById('bottomSheet');
    const sheetBody = document.getElementById('sheetBody');
    if(!sheet || !sheetBody) return;
    sheetBody.innerHTML='';
    const fields = [
      {key:'teorico',label:'Teórico'},
      {key:'acomp1',label:'Acompanhamento 1'},
      {key:'acomp2',label:'Acompanhamento 2'},
      {key:'acomp3',label:'Acompanhamento 3'},
      {key:'acomp4',label:'Acompanhamento 4'},
    ];
    fields.forEach(f=>{
      const wrapper = document.createElement('div');
      wrapper.className='sheet-row';
      const left = document.createElement('div');
      left.innerHTML=`<label class="mb-0">${f.label}</label>`;
      const right = document.createElement('div');
      if(user.role==='ADM'){
        const inp=document.createElement('input');
        inp.type='date';
        inp.value=sheetState[f.key]||'';
        inp.className='form-control';
        inp.addEventListener('input',()=>sheetState[f.key]=inp.value);
        right.appendChild(inp);
      }else{
        right.innerHTML=`<div class="date-badge ${sheetState[f.key]?'filled':'empty'}">${sheetState[f.key]||'-'}</div>`;
      }
      wrapper.appendChild(left);
      wrapper.appendChild(right);
      sheetBody.appendChild(wrapper);
    });
    sheet.classList.add('show');
    sheet.setAttribute('aria-hidden','false');

    const saveBtn = document.getElementById('saveSheet');
    if(saveBtn){
      saveBtn.onclick = async ()=>{
        if(user.role!=='ADM'){ closeSheet(); return; }
        const updates=[];
        for(const k of ['teorico','acomp1','acomp2','acomp3','acomp4']){
          updates.push(fetch(`/api/pessoas/${currentSheetId}`,{
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({field:k,value:sheetState[k]||null})
          }));
        }
        await Promise.all(updates);
        closeSheet();
        carregar();
      };
    }
  }
  function closeSheet(){
    const sheet=document.getElementById('bottomSheet');
    if(sheet){
      sheet.classList.remove('show');
      sheet.setAttribute('aria-hidden','true');
    }
  }

  // ==================== MODAL ADD ====================
  const btnAddEl = document.getElementById('btnAdd');
  const btnSalvarAddEl = document.getElementById('btnSalvarAdd');
  if(btnAddEl) btnAddEl.addEventListener('click',()=>{
    const inputNome = document.getElementById('addNome');
    if(inputNome) inputNome.value='';
    const modalEl = document.getElementById('modalAdd');
    if(modalEl){
      modalAdd = new bootstrap.Modal(modalEl);
      modalAdd.show();
    }
  });
  if(btnSalvarAddEl) btnSalvarAddEl.addEventListener('click',async()=>{
    const inputNome = document.getElementById('addNome');
    const nome = inputNome ? inputNome.value.trim() : '';
    if(!nome) return;
    const r = await fetch('/api/pessoas',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({nome})
    });
    if(r.ok){
      if(modalAdd) modalAdd.hide();
      carregar();
    }else{
      const j = await r.json().catch(()=>({error:'erro'}));
      alert(j.error||'Erro ao adicionar');
    }
  });

  // ==================== CLOSE SHEET BUTTON ====================
  const closeSheetBtn = document.getElementById('closeSheet');
  if(closeSheetBtn) closeSheetBtn.addEventListener('click',closeSheet);

  // ==================== THEME TOGGLE ====================
  const themeToggleBtn = document.getElementById('themeToggle');
  function aplicarTema(savedTheme=null){
    let tema = savedTheme || localStorage.getItem('tema') || 'dark';
    document.body.setAttribute('data-theme',tema);
  }
  aplicarTema();

  if(themeToggleBtn){
    themeToggleBtn.addEventListener('click',()=>{
      const cur = document.body.getAttribute('data-theme')||'dark';
      const next = cur==='light'?'dark':'light';
      document.body.setAttribute('data-theme',next);
      localStorage.setItem('tema',next);
    });
  }

  // detect system preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  prefersDark.addEventListener("change", () => aplicarTema());
  
  // ==================== LOGOUT ====================
  const btnLogoutEl = document.getElementById('btnLogout');
  if(btnLogoutEl){
    btnLogoutEl.addEventListener('click',async()=>{
      await fetch('/api/logout',{method:'POST'});
      window.location='/login.html';
    });
  }

  // ==================== HELPER ====================
  function escapeHtml(s=''){
    return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  // ==================== INIT ====================
  await checkSession();
  await carregar();
});
