// Monta o bloco de HTML da newsletter a partir das oportunidades aprovadas.
//
// Beehiiv (plano free) não tem API de publicação — o fluxo é copiar este HTML
// e colar num bloco de HTML dentro do editor de posts da Beehiiv. Por isso o
// estilo fica todo inline (nada de <style>/<link>): o sanitizador da Beehiiv
// remove tags de estilo separadas, então isso também deixa o bloco pronto caso
// o projeto migre pro plano Enterprise e passe a publicar via API no futuro.
export function buildNewsletterHtml(items) {
  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:0 0 18px 0; vertical-align:top;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding-bottom:4px;">
              <span style="font-family:Georgia,serif; font-weight:700; font-size:16px; color:#0f172a;">
                ${i + 1}. ${escapeHtml(it.title)}
              </span>
            </td>
          </tr>
          ${it.summary ? `
          <tr>
            <td style="padding-bottom:6px;">
              <span style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.5; color:#334155;">
                ${escapeHtml(it.summary)}
              </span>
            </td>
          </tr>` : ''}
          <tr>
            <td>
              <span style="font-family:Arial,Helvetica,sans-serif; font-size:12.5px; color:#64748b;">
                ${it.deadline ? `Prazo: ${escapeHtml(it.deadline)}` : ''}
                ${it.deadline && it.instaAccount ? ' &middot; ' : ''}
                ${it.instaAccount ? `via @${escapeHtml(it.instaAccount)}` : ''}
              </span>
              ${it.link ? `
              <br/>
              <a href="${escapeAttr(it.link)}" style="font-family:Arial,Helvetica,sans-serif; font-size:13px; font-weight:600; color:#2563eb; text-decoration:none;">
                Ver oportunidade &rarr;
              </a>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; max-width:600px;">
${rows}
</table>`;
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', '&quot;');
}
