(function(){
  const LS = window.localStorage;
  const state = {
    primitives: [], // {name, base?, unit?}
    messages: {},   // key: "Name.vX" -> { name, version, fields:[{name,type,array,required}] }
    topics: []      // {name, transport, payload, qos, owner, hz}
  };

  // DOM refs
  const dom = {
    // primitives
    primName: document.getElementById('primName'),
    primBase: document.getElementById('primBase'),
    primUnit: document.getElementById('primUnit'),
    addPrimitive: document.getElementById('addPrimitive'),
    primitiveTable: document.querySelector('#primitiveTable tbody'),
    // messages
    msgName: document.getElementById('msgName'),
    msgVersion: document.getElementById('msgVersion'),
    addMessage: document.getElementById('addMessage'),
    fieldName: document.getElementById('fieldName'),
    fieldType: document.getElementById('fieldType'),
    fieldArray: document.getElementById('fieldArray'),
    fieldRequired: document.getElementById('fieldRequired'),
    addField: document.getElementById('addField'),
    msgSelect: document.getElementById('msgSelect'),
    deleteMessage: document.getElementById('deleteMessage'),
    fieldTable: document.querySelector('#fieldTable tbody'),
    // topics
    topicName: document.getElementById('topicName'),
    topicTransport: document.getElementById('topicTransport'),
    topicPayload: document.getElementById('topicPayload'),
    topicQos: document.getElementById('topicQos'),
    topicOwner: document.getElementById('topicOwner'),
    topicHz: document.getElementById('topicHz'),
    addTopic: document.getElementById('addTopic'),
    topicTable: document.querySelector('#topicTable tbody'),
    // export
    downloadPrimitives: document.getElementById('downloadPrimitives'),
    downloadMessages: document.getElementById('downloadMessages'),
    downloadTopics: document.getElementById('downloadTopics'),
    preview: document.getElementById('preview')
  };

  // init
  function load() {
    try {
      const s = JSON.parse(LS.getItem('icatalog') || '{}');
      if (s.primitives) state.primitives = s.primitives;
      if (s.messages) state.messages = s.messages;
      if (s.topics) state.topics = s.topics;
    } catch {}
  }
  function save() {
    LS.setItem('icatalog', JSON.stringify(state));
  }
  function ensureDefaultPrims() {
    if (state.primitives.length === 0) {
      state.primitives = [
        {name:'int32'}, {name:'float32'}, {name:'boolean'}, {name:'string'},
        {name:'Angle_deg', base:'float32', unit:'deg'},
        {name:'Temperature_C', base:'float32', unit:'celsius'}
      ];
    }
  }
  function refreshPrimitiveUI() {
    dom.primitiveTable.innerHTML = '';
    state.primitives.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${p.base||''}</td><td>${p.unit||''}</td>
                      <td><button data-idx="${idx}" class="del-prim">sil</button></td>`;
      dom.primitiveTable.appendChild(tr);
    });
    // options for fieldType
    dom.fieldType.innerHTML = '';
    state.primitives.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name; opt.textContent = p.name;
      dom.fieldType.appendChild(opt);
    });
  }
  function refreshMessagesUI() {
    // msg select
    const cur = dom.msgSelect.value;
    dom.msgSelect.innerHTML = '';
    Object.keys(state.messages).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k;
      dom.msgSelect.appendChild(opt);
    });
    if (cur && state.messages[cur]) dom.msgSelect.value = cur;
    refreshFieldsTable();
    // topic payload list
    dom.topicPayload.innerHTML = '';
    Object.keys(state.messages).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k;
      dom.topicPayload.appendChild(opt);
    });
  }
  function refreshFieldsTable() {
    dom.fieldTable.innerHTML = '';
    const key = dom.msgSelect.value;
    const msg = state.messages[key];
    if (!msg) return;
    (msg.fields || []).forEach((f, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${f.name}</td><td>${f.type}</td>
                      <td>${f.array ? '✓' : ''}</td><td>${f.required ? '✓' : ''}</td>
                      <td><button data-idx="${idx}" class="del-field">sil</button></td>`;
      dom.fieldTable.appendChild(tr);
    });
  }
  function refreshTopicsUI() {
    dom.topicTable.innerHTML = '';
    state.topics.forEach((t, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.name}</td><td>${t.transport}</td>
                      <td>${t.payload}</td><td>${t.qos}</td>
                      <td>${t.owner||''}</td><td>${t.hz||''}</td>
                      <td><button data-idx="${idx}" class="del-topic">sil</button></td>`;
      dom.topicTable.appendChild(tr);
    });
  }

  function yamlEscape(s){ return String(s).replace(/"/g,'\"'); }

  function buildPrimitivesYaml() {
    const lines = ['# Şirket baz tip & typedef havuzu', 'primitives:'];
    state.primitives.forEach(p => {
      if (!p.base) {
        lines.push(`  - name: ${p.name}`);
      }
    });
    lines.push('typedefs:');
    state.primitives.forEach(p => {
      if (p.base) {
        lines.push(`  - name: ${p.name}`);
        lines.push(`    base: ${p.base}`);
        if (p.unit) lines.push(`    unit: ${p.unit}`);
      }
    });
    lines.push('rules:\n  requireUnitForNumbers: true');
    return lines.join('\n');
  }

  function buildMessageYaml(msg) {
    const lines = [
      'type: message',
      `name: ${msg.name}.${msg.version}`,
      'properties:'
    ];
    (msg.fields||[]).forEach(f => {
      lines.push(`  - name: ${f.name}`);
      lines.push(`    type: ${f.type}`);
      if (f.required) lines.push(`    required: true`);
      if (f.array) lines.push(`    array: true`);
    });
    return lines.join('\n');
  }

  function buildTopicYaml(t) {
    const qos = t.qos === 'sensor_data'
      ? { reliability:'BEST_EFFORT', durability:'VOLATILE', history:'KEEP_LAST', depth:5 }
      : { reliability:'RELIABLE', durability:'VOLATILE', history:'KEEP_LAST', depth:10 };
    const lines = [
      'type: topic',
      `name: ${t.name}`,
      `transport: ${t.transport}`,
      `payload: ${t.payload}`,
      'qos:',
      `  reliability: ${qos.reliability}`,
      `  durability: ${qos.durability}`,
      `  history: ${qos.history}`,
      `  depth: ${qos.depth}`,
      'metadata:',
      `  owner: ${t.owner||''}`,
      `  frequency_hz: ${t.hz||''}`,
      `  lifecycle: active`
    ];
    return lines.join('\n');
  }

  function download(text, filename) {
    const blob = new Blob([text], {type:'text/yaml'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // events
  dom.addPrimitive.addEventListener('click', () => {
    const name = dom.primName.value.trim();
    const base = dom.primBase.value.trim();
    const unit = dom.primUnit.value.trim();
    if (!name) return alert('İsim gerekli');
    // unique
    if (state.primitives.find(p => p.name === name)) return alert('Bu isim zaten var');
    state.primitives.push({ name, base: base || undefined, unit: unit || undefined });
    save(); refreshPrimitiveUI();
    dom.primName.value = ''; dom.primUnit.value=''; dom.primBase.value='';
  });

  dom.primitiveTable.addEventListener('click', e => {
    if (e.target.matches('.del-prim')) {
      const idx = +e.target.dataset.idx;
      state.primitives.splice(idx,1);
      save(); refreshPrimitiveUI();
    }
  });

  dom.addMessage.addEventListener('click', () => {
    const name = dom.msgName.value.trim();
    const version = dom.msgVersion.value.trim() || 'v1';
    if (!name) return alert('Mesaj adı gerekli');
    const key = `${name}.${version}`;
    if (state.messages[key]) return alert('Bu mesaj zaten var');
    state.messages[key] = { name, version, fields: [] };
    save(); refreshMessagesUI();
    dom.msgSelect.value = key;
    refreshFieldsTable();
  });

  dom.addField.addEventListener('click', () => {
    const key = dom.msgSelect.value;
    if (!key) return alert('Önce bir mesaj oluştur ve seç');
    const f = {
      name: dom.fieldName.value.trim(),
      type: dom.fieldType.value,
      array: dom.fieldArray.checked,
      required: dom.fieldRequired.checked
    };
    if (!f.name) return alert('Alan adı gerekli');
    state.messages[key].fields.push(f);
    save(); refreshFieldsTable();
    dom.fieldName.value = '';
  });

  dom.deleteMessage.addEventListener('click', () => {
    const key = dom.msgSelect.value;
    if (!key) return;
    if (!confirm(key + ' silinsin mi?')) return;
    delete state.messages[key];
    save(); refreshMessagesUI();
  });

  dom.fieldTable.addEventListener('click', e => {
    if (e.target.matches('.del-field')) {
      const idx = +e.target.dataset.idx;
      const key = dom.msgSelect.value;
      state.messages[key].fields.splice(idx,1);
      save(); refreshFieldsTable();
    }
  });

  dom.addTopic.addEventListener('click', () => {
    const t = {
      name: (dom.topicName.value||'').trim(),
      transport: dom.topicTransport.value,
      payload: dom.topicPayload.value,
      qos: dom.topicQos.value,
      owner: dom.topicOwner.value.trim(),
      hz: +dom.topicHz.value || undefined
    };
    if (!t.name) return alert('Topic adı gerekli');
    if (!t.payload) return alert('Payload (mesaj) seçin');
    if (state.topics.find(x => x.name === t.name)) return alert('Bu topic zaten var');
    state.topics.push(t);
    save(); refreshTopicsUI();
  });

  dom.topicTable.addEventListener('click', e => {
    if (e.target.matches('.del-topic')) {
      const idx = +e.target.dataset.idx;
      state.topics.splice(idx,1);
      save(); refreshTopicsUI();
    }
  });

  dom.downloadPrimitives.addEventListener('click', () => {
    const y = buildPrimitivesYaml();
    dom.preview.value = y;
    download(y, 'primitives.yaml');
  });

  dom.downloadMessages.addEventListener('click', () => {
    const keys = Object.keys(state.messages);
    if (keys.length === 0) return alert('Mesaj yok');
    const outAll = [];
    keys.forEach(k => {
      const y = buildMessageYaml(state.messages[k]);
      outAll.push(`# ${k}\n` + y + '\n');
      download(y, `messages/${k}.yaml`);
    });
    dom.preview.value = outAll.join('\n');
  });

  dom.downloadTopics.addEventListener('click', () => {
    if (state.topics.length === 0) return alert('Topic yok');
    const outAll = [];
    state.topics.forEach(t => {
      const y = buildTopicYaml(t);
      outAll.push(`# ${t.name}\n` + y + '\n');
      const safe = t.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      download(y, `topics/${safe}.yaml`);
    });
    dom.preview.value = outAll.join('\n');
  });

  // boot
  load();
  ensureDefaultPrims();
  refreshPrimitiveUI();
  refreshMessagesUI();
  refreshTopicsUI();
})();