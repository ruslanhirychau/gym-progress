'use strict';
const $=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
const date=s=>new Date(s+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'});
const fullDate=s=>new Date(s+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],metric='weight',filename='workouts.csv',calendarMonth='',selectedDay='';
function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');let cells=[],row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(s=>s.trim()))cells.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('В CSV не закрыты кавычки.');row.push(field);if(row.some(s=>s.trim()))cells.push(row);
 const headers=(cells.shift()||[]).map(s=>s.trim());const required=['Workout','Date','Exercise','Set','Reps','Weight (kg)'];const indexes=required.map(h=>headers.indexOf(h));if(indexes.some(i=>i<0))throw Error('Нужны столбцы: '+required.join(', ')+'. Разделитель — запятая.');
 if(!cells.length)throw Error('В файле нет подходов.');
 return cells.map((r,i)=>{const [workout,d,exercise,set,reps,weight]=indexes.map(j=>(r[j]??'').trim());const validDate=/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;if(!workout||!exercise||!validDate||![set,reps,weight].every(v=>v!==''&&Number.isFinite(Number(v)))||+set<1||!Number.isInteger(+set)||+reps<0||!Number.isInteger(+reps)||+weight<0)throw Error('Некорректные данные в строке '+(i+2)+'. Проверьте дату, подход, повторения и вес.');return{workout,date:d,exercise,set:+set,reps:+reps,weight:+weight};});
}
function series(data){const groups=new Map();data.forEach(r=>{let g=groups.get(r.date);if(!g){g={date:r.date,weight:0,volume:0,reps:0,sets:0};groups.set(r.date,g);}g.weight=Math.max(g.weight,r.weight);g.volume+=r.weight*r.reps;g.reps+=r.reps;g.sets++;});return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function filteredRows(){let cutoff='';if(rows.length&&$('range').value!=='all'){const latest=rows.reduce((a,r)=>r.date>a?r.date:a,'');const d=new Date(latest+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-Number($('range').value)+1);cutoff=d.toISOString().slice(0,10);}return rows.filter(r=>r.date>=cutoff);}
function chart(points,name){const W=520,H=190,left=48,right=18,top=24,bottom=35;const max=Math.max(...points.map(p=>p[metric]),1)*1.12;const first=Date.parse(points[0].date),last=Date.parse(points.at(-1).date);const x=p=>first===last?(W+left-right)/2:left+(Date.parse(p.date)-first)/(last-first)*(W-left-right);const y=p=>H-bottom-p[metric]/max*(H-top-bottom);const xy=points.map(p=>`${x(p)},${y(p)}`).join(' ');let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}: ${esc(metric==='weight'?'максимальный вес':metric==='volume'?'объём':'повторения')} по датам">`;
 for(let n=0;n<3;n++){const v=max*n/2,Y=H-bottom-v/max*(H-top-bottom);svg+=`<line x1="${left}" x2="${W-right}" y1="${Y}" y2="${Y}" stroke="#303a48" stroke-dasharray="3 5"/><text x="${left-9}" y="${Y+4}" text-anchor="end">${esc(fmt.format(v))}</text>`;}
 svg+=`<polygon points="${x(points[0])},${H-bottom} ${xy} ${x(points.at(-1))},${H-bottom}" fill="#c6f36b" opacity=".065"/><polyline points="${xy}" fill="none" stroke="#c6f36b" stroke-width="2.5" stroke-linejoin="round"/>`;
 points.forEach(p=>{const label=`${fullDate(p.date)} · ${fmt.format(p[metric])} ${metric==='reps'?'повт.':'кг'} · ${p.sets} подходов`;svg+=`<circle cx="${x(p)}" cy="${y(p)}" r="4" fill="#c6f36b" stroke="#191e27" stroke-width="2" tabindex="0" data-tip="${esc(label)}" aria-label="${esc(label)}"><title>${esc(label)}</title></circle>`;});
 svg+=`<text x="${left}" y="${H-8}">${esc(date(points[0].date))}</text>`;if(points.length>1)svg+=`<text x="${W-right}" y="${H-8}" text-anchor="end">${esc(date(points.at(-1).date))}</text>`;return svg+'</svg><div class="tooltip" hidden></div>';}
function render(){const data=filteredRows();$('sessions').textContent=fmt.format(new Set(data.map(r=>r.date+'|'+r.workout)).size);$('exercises').textContent=fmt.format(new Set(data.map(r=>r.exercise)).size);$('sets').textContent=fmt.format(data.length);$('volume').textContent=fmt.format(data.reduce((s,r)=>s+r.weight*r.reps,0));const groups=new Map();data.forEach(r=>{if(!groups.has(r.exercise))groups.set(r.exercise,[]);groups.get(r.exercise).push(r);});const entries=[...groups].filter(([name])=>name.toLowerCase().includes($('search').value.toLowerCase().trim())).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]));$('count').textContent=entries.length+' из '+groups.size;$('metric-help').textContent=metric==='weight'?'Самый большой вес за тренировку · кг':metric==='volume'?'Вес × повторения за тренировку · кг':'Сумма повторений за тренировку';
 $('cards').innerHTML=entries.length?entries.map(([name,rs])=>{const ps=series(rs),last=ps.at(-1)[metric],first=ps[0][metric],delta=last-first;const change=ps.length<2?'Одна дата':delta===0?'Без изменений':(delta>0?'+':'')+fmt.format(delta)+' '+(metric==='reps'?'повт.':'кг');return `<article class="card"><div class="card-head"><div><h3>${esc(name)}</h3><span class="muted">${ps.length} дат · ${rs.length} подходов</span></div></div><div class="card-value"><strong>${fmt.format(last)}</strong><span class="unit">${metric==='reps'?'повт.':'кг'}</span><span class="delta ${delta<0?'negative':delta===0||ps.length<2?'neutral':''}" title="Изменение между первой и последней датой выбранного периода">${change}</span></div><div class="chart">${chart(ps,name)}</div><details><summary>Все подходы</summary><div class="table-wrap"><table><thead><tr><th>Дата</th><th>Подход</th><th>Повт.</th><th>Вес, кг</th></tr></thead><tbody>${[...rs].sort((a,b)=>b.date.localeCompare(a.date)||a.set-b.set).map(r=>`<tr><td>${esc(date(r.date))} ${r.date.slice(0,4)}</td><td>${r.set}</td><td>${r.reps}</td><td>${fmt.format(r.weight)}</td></tr>`).join('')}</tbody></table></div></details></article>`;}).join(''):'<p class="empty">Упражнения не найдены. Попробуйте другой поиск или период.</p>';
 $('cards').querySelectorAll('circle').forEach(c=>{const tip=c.closest('.chart').querySelector('.tooltip');const show=()=>{tip.textContent=c.dataset.tip;tip.hidden=false;};const hide=()=>{tip.hidden=true;};c.addEventListener('mouseenter',show);c.addEventListener('mouseleave',hide);c.addEventListener('focus',show);c.addEventListener('blur',hide);c.addEventListener('click',show);});
}

function renderSchedule(){
 const days=new Map();rows.forEach(r=>{if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r);});
 const dates=[...days.keys()].sort();
 $('schedule').hidden=!dates.length;
 if(!dates.length)return;
 if(!selectedDay)selectedDay=dates.at(-1);
 if(!calendarMonth)calendarMonth=selectedDay.slice(0,7);
 const [year,month]=calendarMonth.split('-').map(Number);
 const first=new Date(Date.UTC(year,month-1,1));
 $('calendar-month').textContent=first.toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'});
 const offset=(first.getUTCDay()+6)%7,total=new Date(Date.UTC(year,month,0)).getUTCDate();
 $('calendar-days').innerHTML='<span class="calendar-gap" aria-hidden="true"></span>'.repeat(offset)+Array.from({length:total},(_,i)=>{
  const d=calendarMonth+'-'+String(i+1).padStart(2,'0'),rs=days.get(d)||[],names=[...new Set(rs.map(r=>r.workout))];
  return `<button class="calendar-day ${rs.length?'has-workout':''}" data-day="${d}" aria-pressed="${d===selectedDay}" aria-label="${esc(fullDate(d)+': '+(names.join(', ')||'Нет записей'))}"><span>${i+1}</span>${names.length?`<small>${esc(names.join(' / '))}</small>`:''}</button>`;
 }).join('');
 $('prev-month').disabled=calendarMonth<=dates[0].slice(0,7);
 $('next-month').disabled=calendarMonth>=dates.at(-1).slice(0,7);
 const rs=days.get(selectedDay)||[],workouts=[...new Set(rs.map(r=>r.workout))];
 const weekday=new Date(selectedDay+'T12:00:00Z').toLocaleDateString('ru-RU',{weekday:'long',timeZone:'UTC'});
 $('day-details').innerHTML=`<p class="day-weekday">${esc(weekday)}</p><h3>${esc(fullDate(selectedDay))}</h3>`+(rs.length?workouts.map(workout=>{
  const sets=rs.filter(r=>r.workout===workout),exercises=[...new Set(sets.map(r=>r.exercise))];
  return `<div class="session-detail"><h4>${esc(workout)}</h4><p class="muted">${exercises.length} упражнений · ${sets.length} подходов · ${fmt.format(sets.reduce((sum,r)=>sum+r.weight*r.reps,0))} кг объёма</p><ul class="session-exercises">${exercises.map(name=>{
   const es=sets.filter(r=>r.exercise===name);
   return `<li><button class="exercise-link" data-exercise="${esc(name)}">${esc(name)} <span aria-hidden="true">↗</span></button><p>${es.sort((a,b)=>a.set-b.set).map(r=>`${r.reps} × ${fmt.format(r.weight)} кг`).join(' · ')}</p></li>`;
  }).join('')}</ul></div>`;
 }).join(''):'<p class="schedule-note">В дневнике нет тренировок за этот день.</p>');
}
function moveMonth(delta){const [year,month]=calendarMonth.split('-').map(Number);calendarMonth=new Date(Date.UTC(year,month-1+delta,1)).toISOString().slice(0,7);renderSchedule();}
$('prev-month').addEventListener('click',()=>moveMonth(-1));
$('next-month').addEventListener('click',()=>moveMonth(1));
$('latest-session').addEventListener('click',()=>{selectedDay=rows.map(r=>r.date).sort().at(-1);calendarMonth=selectedDay?.slice(0,7)||'';renderSchedule();});
$('calendar-days').addEventListener('click',e=>{const button=e.target.closest('[data-day]');if(!button)return;selectedDay=button.dataset.day;renderSchedule();$('calendar-days').querySelector(`[data-day="${selectedDay}"]`)?.focus();});
$('day-details').addEventListener('click',e=>{const button=e.target.closest('[data-exercise]');if(!button)return;$('search').value=button.dataset.exercise;$('range').value='all';render();$('progress').scrollIntoView({behavior:'smooth',block:'start'});$('search').focus({preventScroll:true});});

function load(text,name){const next=parseCSV(text);rows=next;filename=name;$('error').hidden=true;$('filename').textContent=name;const dates=rows.map(r=>r.date).sort();$('period').textContent=fullDate(dates[0])+' — '+fullDate(dates.at(-1));$('search').value='';$('range').value='all';calendarMonth='';selectedDay='';renderSchedule();render();}
function fail(e){$('error').textContent=e.message;$('error').hidden=false;}
['search','range'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
document.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{metric=b.dataset.metric;document.querySelectorAll('[data-metric]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
$('file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{load(await f.text(),f.name);}catch(err){fail(err);}e.target.value='';});
const user=new URLSearchParams(location.search).get('u');
function emptyState(){renderSchedule();filename='';$('filename').textContent='CSV не выбран';$('period').textContent='';render();$('cards').innerHTML='<p class="empty">Загрузите CSV, чтобы увидеть графики.</p>';}
if(user==='ruslan'){
 fetch('data/ruslan.csv').then(r=>{if(!r.ok)throw Error('Не удалось загрузить данные. Выберите CSV с компьютера.');return r.text();}).then(t=>load(t,'ruslan.csv')).catch(e=>{emptyState();fail(e);});
}else{emptyState();if(user)fail(new Error('Данные для этого пользователя не найдены. Загрузите свой CSV.'));}

if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'get_workout_summary',description:'Read exercise results from the loaded workout CSV.',inputSchema:{type:'object',properties:{exercise:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>k!=='exercise')||('exercise'in input&&typeof input.exercise!=='string'))throw Error('Invalid input');const data=filteredRows().filter(r=>!input.exercise||r.exercise===input.exercise);return {filename,sets:data.length,exercises:[...new Set(data.map(r=>r.exercise))].map(name=>({name,dates:series(data.filter(r=>r.exercise===name))}))};}})).catch(()=>{});}catch{}}
