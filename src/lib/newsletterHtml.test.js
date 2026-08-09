import { describe, expect, test } from 'bun:test';
import { buildNewsletterHtml, slugify } from './newsletterHtml';

describe('buildNewsletterHtml', () => {
  test('renders Beehiiv-ready opportunity blocks and campaign parameters', () => {
    const html = buildNewsletterHtml(
      { title: 'Weekly Drop 28', campaign_slug: 'weekly-drop-28', intro: 'Olá!', outro: 'Até mais!' },
      [{
        title: 'Enlight Fellowship',
        summary: 'Programa totalmente financiado.',
        eligibility: 'ter 18 anos\nter um projeto',
        deadline: '5 de julho',
        fees: 'Gratuito; bolsa completa',
        link: 'https://watson.is/enlight-fellowship-application/',
      }],
    );

    expect(html).toStartWith('<div id="content-blocks">');
    expect(html).toContain('id="enlight-fellowship"');
    expect(html).toContain('<b>Elegibilidade: </b>ter 18 anos; ter um projeto');
    expect(html).toContain('utm_source=accessplus.beehiiv.com');
    expect(html).toContain('utm_medium=referral');
    expect(html).toContain('utm_campaign=weekly-drop-28');
    expect(html).toContain('id="sobre-nos"');
    expect(html).toEndWith('</div>');
  });

  test('escapes catalog text and produces stable anchors', () => {
    const html = buildNewsletterHtml({}, [{ title: 'Oxford Saïd & <Climate>', summary: '<script>alert(1)</script>', link: '' }]);
    expect(slugify('Oxford Saïd & Climate')).toBe('oxford-said-climate');
    expect(html).toContain('Oxford Saïd &amp; &lt;Climate&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
