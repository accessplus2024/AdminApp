const FONT = "'Space Grotesk',Helvetica,Arial,sans-serif";

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}

function withCampaign(rawUrl, campaignSlug) {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('utm_source', 'accessplus.beehiiv.com');
    url.searchParams.set('utm_medium', 'referral');
    if (campaignSlug) url.searchParams.set('utm_campaign', campaignSlug);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function lines(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('; ');
  return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean).join('; ');
}

function textBlock(text) {
  if (!text) return '';
  return `<style>p span[style*="font-size"] { line-height: 1.6; }</style><div style="padding-bottom:12px;padding-left:15px;padding-right:15px;padding-top:12px;"><p style="color:#2D2D2D;color:var(--wt-text-on-background-color) !important;font-family:${FONT};font-size:16px;line-height:1.5;text-align:left;">${escapeHtml(text)}</p></div>`;
}

function opportunityBlock(item, campaignSlug) {
  const title = escapeHtml(item.title);
  const anchor = slugify(item.title) || `oportunidade-${item.position || 0}`;
  const link = withCampaign(item.link, campaignSlug);
  const info = [
    item.eligibility ? `<b>Elegibilidade: </b>${escapeHtml(lines(item.eligibility))}` : '',
    item.deadline ? `<b>Prazo:</b> ${escapeHtml(item.deadline)}` : '',
    item.fees ? `<b>Taxas:</b> ${escapeHtml(item.fees)}` : '',
    link ? `<b>Link:</b>&nbsp;<a class="link" href="${escapeHtml(link)}" target="_blank" style="-webkit-text-decoration:underline #0C4A6E;color:#0C4A6E;font-style:italic;text-decoration:underline #0C4A6E;word-break:break-word;">${escapeHtml(item.link)}</a>` : '',
  ].filter(Boolean).join('<br>');

  return `<div id="${anchor}" style="padding-bottom:4px;padding-left:15px;padding-right:15px;padding-top:16px;"><h2 style="color:#2A2A2A;font-family:${FONT};font-size:24px;font-weight:700;line-height:1.5;margin:0;text-align:left;">${title}</h2></div>${textBlock(item.summary)}<style>p span[style*="font-size"] { line-height: 1.6; }</style><div style="padding-bottom:12px;padding-left:15px;padding-right:15px;padding-top:12px;"><p style="color:#2D2D2D;color:var(--wt-text-on-background-color) !important;font-family:${FONT};font-size:16px;line-height:1.5;text-align:left;">${info}</p></div>`;
}

const divider = '<div style="font-size:0px;line-height:0px;padding:30px 0px 30px;"><div style="margin:0 auto;border-top:3px solid #030712;width:50%;"></div></div>';

function aboutBlock(outro) {
  return `<div id="sobre-nos" style="padding-bottom:4px;padding-left:15px;padding-right:15px;padding-top:16px;"><h1 style="color:#2A2A2A;font-family:${FONT};font-size:28px;font-weight:700;line-height:1.75;margin:0;text-align:left;"><b>Sobre nós</b></h1></div>${textBlock('O Access+ é o maior catálogo de oportunidades acadêmicas online da América Latina, uma plataforma reconhecida por organizações globais como UNESCO-UNEVOC, Fundação HP e Ashoka.')}<style>p span[style*="font-size"] { line-height: 1.6; }</style><div style="padding-bottom:12px;padding-left:15px;padding-right:15px;padding-top:12px;"><p style="color:#2D2D2D;color:var(--wt-text-on-background-color) !important;font-family:${FONT};font-size:16px;line-height:1.5;text-align:left;"><span style="text-decoration:underline;">Website</span>: <a class="link" href="https://www.accessplus.com.br/" target="_blank" style="color:#0C4A6E;font-style:italic;text-decoration:underline #0C4A6E;">https://www.accessplus.com.br/</a><br><span style="text-decoration:underline;">Instagram:</span> <a class="link" href="https://www.instagram.com/accessplusoficial/" target="_blank" style="color:#0C4A6E;font-style:italic;text-decoration:underline #0C4A6E;">@accessplusoficial</a><br><span style="text-decoration:underline;">TikTok:</span> <a class="link" href="https://www.tiktok.com/@accessplusoficial" target="_blank" style="color:#0C4A6E;font-style:italic;text-decoration:underline #0C4A6E;">@accessplusoficial</a></p></div>${textBlock(outro || 'E até mais!')}`;
}

export function buildNewsletterHtml(issue, entriesArg) {
  // Backward compatibility with the former buildNewsletterHtml(items) helper.
  const entries = Array.isArray(issue) ? issue : (entriesArg || issue?.entries || []);
  const meta = Array.isArray(issue) ? {} : (issue || {});
  const campaign = meta.campaign_slug || slugify(meta.title || meta.subject);
  const content = entries.map((entry) => opportunityBlock(entry, campaign)).join(divider);
  const intro = meta.intro ? `${textBlock(meta.intro)}${divider}` : '';
  return `<div id="content-blocks">${intro}${content}${content ? divider : ''}${aboutBlock(meta.outro)}</div>`;
}
