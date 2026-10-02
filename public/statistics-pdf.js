// Self-contained PDF export. Standard PDF fonts cover Spanish without network requests.
export function statisticsPdf(month, items) {
  const pages = []; let commands = [], y;
  const hex = value => [...String(value)].map(char => {
    const code = char.codePointAt(0);
    const special = {8364:128,8211:150,8212:151,8216:145,8217:146,8220:147,8221:148,8230:133};
    return (code <= 255 ? code : special[code] || 63).toString(16).padStart(2, '0');
  }).join('');
  const text = (value, x, top, size = 10) => commands.push(`BT /F1 ${size} Tf 1 0 0 1 ${x} ${top} Tm <${hex(value)}> Tj ET`);
  const wrap = (value, limit, size = 10) => {
    const width = text => [...text].reduce((sum, char) => sum + size * (/[ilI.,:;!|' ]/.test(char) ? 0.3 : /[WMwm@]/.test(char) ? 0.95 : /[A-Z]/.test(char) ? 0.78 : 0.6), 0);
    const words = String(value).split(/\s+/), lines = []; let line = '';
    for (const word of words) {
      if (line && width(line + ' ' + word) > limit) { lines.push(line); line = ''; }
      for (const char of word) {
        if (width(line + char) > limit) { lines.push(line); line = ''; }
        line += char;
      }
      line += ' ';
    }
    line = line.trim();
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const totals = ['views','requests','email_requests','whatsapp_requests'].map(field => items.reduce((sum, item) => sum + Number(item[field]), 0));
  const monthLabel = new Date(`${month}-15T12:00:00Z`).toLocaleDateString('es-UY', {month:'long', year:'numeric', timeZone:'America/Montevideo'});
  const heading = () => {
    text('LRV Automotores', 40, 798, 19);
    text(`Estadísticas mensuales - ${monthLabel}`, 40, 775, 13);
    text('Período según la hora de Uruguay (UTC-03:00).', 40, 755, 9);
    y = 729;
  };
  const tableHeading = () => {
    commands.push(`0.9 g 40 ${y-8} 515 22 re f 0 g`);
    ['Vehículo','Vistas','Solicitudes','Correo','WhatsApp'].forEach((label,i) => text(label,[45,300,350,423,480][i],y,9));
    y -= 27;
  };
  heading();
  text(`Totales: ${totals[0]} vistas | ${totals[1]} solicitudes | ${totals[2]} correo | ${totals[3]} WhatsApp`,40,y,10); y -= 23;
  for (const [field,label] of [['views','Más visto'],['requests','Más solicitudes']]) {
    const highest = Math.max(0,...items.map(item => Number(item[field])));
    const leaders = items.filter(item => highest > 0 && Number(item[field]) === highest);
    const message = leaders.length ? `${label}: ${leaders.map(item=>item.vehicle).join(' / ')} (${highest}${leaders.length > 1 ? ' por vehículo; empate' : ''})` : `${label}: sin registros`;
    for (const line of wrap(message,505)) {
      if (y < 120) { pages.push(commands); commands=[]; heading(); }
      text(line,40,y,10); y-=15;
    }
    y-=7;
  }
  tableHeading();
  for (const item of items) {
    const lines = wrap(item.vehicle,235,9), height = Math.max(25,lines.length*13+10);
    if (y-height < 110) { pages.push(commands); commands=[]; heading(); tableHeading(); }
    lines.forEach((line,i)=>text(line,45,y-i*13,9));
    [item.views,item.requests,item.email_requests,item.whatsapp_requests].forEach((value,i)=>text(value,[300,350,423,480][i],y,10));
    y -= height; commands.push(`0.8 G 40 ${y+9} m 555 ${y+9} l S 0 G`);
  }
  if (y < 130) { pages.push(commands); commands=[]; heading(); tableHeading(); }
  text('TOTAL',45,y,10); totals.forEach((value,i)=>text(value,[300,350,423,480][i],y,10));
  pages.push(commands);
  pages.forEach((page,i) => {
    commands=page;
    text('Vistas desde el 02/10/2026: una por vehículo y sesión de pestaña; no personas únicas.',40,76,8);
    text('Solicitudes: intención de contacto; no confirman la entrega del mensaje.',40,62,8);
    text(`Página ${i+1} de ${pages.length}`,480,40,8);
  });
  const objects = [null,'<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] >>`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  pages.forEach((page,i) => {
    const stream=page.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf='%PDF-1.4\n', offsets=[0];
  for(let i=1;i<objects.length;i++) { offsets.push(pdf.length); pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref=pdf.length;
  pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1)) pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf],{type:'application/pdf'});
}
