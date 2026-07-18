import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Input, Textarea, Select, Field, Switch, Badge, Dialog } from '../components';
import { Ic } from '../lib/icons';
import D from '../lib/data';

function Chips({ options, value, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            style={{
              padding: '7px 13px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'),
              background: on ? 'var(--azul)' : 'var(--card)',
              color: on ? '#fff' : 'var(--ink)',
              transition: 'all .12s ease',
            }}>{o}</button>
        );
      })}
    </div>
  );
}

function EditorSection({ title, children }) {
  return (
    <Card flat>
      <CardHeader style={{ paddingBottom: 4 }}><CardTitle style={{ fontSize: 16 }}>{title}</CardTitle></CardHeader>
      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12 }}>{children}</CardBody>
    </Card>
  );
}

export default function OpportunityEditor({ opp, onCancel, onSave, onDelete }) {
  const isNew = !opp;
  const get = (k, d) => (opp && opp[k] != null ? opp[k] : d);
  const [form, setForm] = useState({
    titulo: get('titulo', ''), org: get('org', ''), tipo: get('tipo', 'Bolsas de Estudo'),
    link: get('link', ''), lingua: get('lingua', ''),
    areaAtuacao: get('areaAtuacao', ''), custo: get('custo', 'Gratuito'), formato: get('formato', 'Online'),
    local: get('local', ''), prazo: get('prazo', ''), dataInicio: get('dataInicio', ''),
    recursos: get('recursos', []),
    nivel: get('nivel', []), publico: get('publico', []), interesse: get('interesse', []),
    inscricoesAbertas: get('inscricoesAbertas', true), destaque: get('destaque', false),
    descricao: get('descricao', ''),
    elegibilidade: (get('elegibilidade', []) || []).join('\n'),
    processo: get('processo', ''),
    dicas: (get('dicas', []) || []).join('\n'),
    infoAdicional: get('infoAdicional', ''),
    tags: (get('tagsRelacionadas', []) || []).join(', '),
  });
  const [confirm, setConfirm] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleIn = (k) => (o) => set(k, form[k].includes(o) ? form[k].filter((x) => x !== o) : form[k].concat(o));
  const F = (key) => D.filters.find((f) => f.key === key).options;

  // --- Recursos online (vídeos, posts, links úteis) ---
  const addRecurso = (plataforma) =>
    set('recursos', [...form.recursos, { plataforma, titulo: '', meta: '' }]);
  const setRecurso = (i, k, v) =>
    set('recursos', form.recursos.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const removeRecurso = (i) =>
    set('recursos', form.recursos.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" iconLeft={Ic('arrow-left', 'ico-sm')} onClick={onCancel}>Voltar</Button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>
          {isNew ? 'Nova oportunidade' : 'Editar oportunidade'}
        </h1>
        {!isNew && <Badge variant={D.statusVariant[opp.status]} dot>{opp.status}</Badge>}
      </div>

      <EditorSection title="Informações básicas">
        <Field label="Título da oportunidade" htmlFor="ed-t">
          <Input id="ed-t" value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Olimpíada Brasileira de Matemática" />
        </Field>
        <Field label="Link da oportunidade" htmlFor="ed-link" hint="A página oficial de inscrição/informações.">
          <Input id="ed-link" type="url" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://..." />
        </Field>
        <div className="ap-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Organização" htmlFor="ed-o"><Input id="ed-o" value={form.org} onChange={(e) => set('org', e.target.value)} /></Field>
          <Field label="Área de atuação" htmlFor="ed-a"><Input id="ed-a" value={form.areaAtuacao} onChange={(e) => set('areaAtuacao', e.target.value)} placeholder="Ex.: Matemática" /></Field>
        </div>
        <Field label="Língua exigida" htmlFor="ed-lang" hint="Língua necessária para participar.">
          <Select id="ed-lang" value={form.lingua} onChange={(e) => set('lingua', e.target.value)}>
            <option value="">—</option>
            <option>Português</option><option>Inglês</option><option>Espanhol</option>
            <option>Francês</option><option>Outro</option>
          </Select>
        </Field>
        <div className="ap-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Tipo" htmlFor="ed-tp">
            <Select id="ed-tp" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              {F('tipo').map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Custo" htmlFor="ed-c">
            <Select id="ed-c" value={form.custo} onChange={(e) => set('custo', e.target.value)}>
              {F('custo').map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
      </EditorSection>

      <EditorSection title="Classificação">
        <Field label="Nível"><Chips options={F('nivel')} value={form.nivel} onToggle={toggleIn('nivel')} /></Field>
        <Field label="Público-alvo"><Chips options={F('publico')} value={form.publico} onToggle={toggleIn('publico')} /></Field>
        <Field label="Interesse"><Chips options={F('interesse')} value={form.interesse} onToggle={toggleIn('interesse')} /></Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)' }}>
          <Switch label="Inscrições abertas" checked={form.inscricoesAbertas} onChange={(e) => set('inscricoesAbertas', e.target.checked)} />
          <Switch label="Destacar na home"   checked={form.destaque}         onChange={(e) => set('destaque', e.target.checked)} />
        </div>
      </EditorSection>

      <EditorSection title="Datas e formato">
        <div className="ap-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Prazo de inscrição" htmlFor="ed-p"><Input id="ed-p" value={form.prazo}      onChange={(e) => set('prazo', e.target.value)}      placeholder="Ex.: 30 jun 2026" /></Field>
          <Field label="Início"             htmlFor="ed-i"><Input id="ed-i" value={form.dataInicio} onChange={(e) => set('dataInicio', e.target.value)} placeholder="Ex.: Provas a partir de set 2026" /></Field>
        </div>
        <div className="ap-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Formato" htmlFor="ed-f">
            <Select id="ed-f" value={form.formato} onChange={(e) => set('formato', e.target.value)}>
              <option>Online</option><option>Presencial</option><option>Híbrido</option>
            </Select>
          </Field>
          <Field label="Local" htmlFor="ed-l"><Input id="ed-l" value={form.local} onChange={(e) => set('local', e.target.value)} placeholder="Ex.: Nacional" /></Field>
        </div>
      </EditorSection>

      <EditorSection title="Conteúdo">
        <Field label="Descrição" htmlFor="ed-d">
          <Textarea id="ed-d" rows={3} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Explique, em linguagem simples, para quem é a oportunidade." />
        </Field>
        <Field label="Elegibilidade e guia de aplicação" htmlFor="ed-el" hint="Um item por linha.">
          <Textarea id="ed-el" rows={3} value={form.elegibilidade} onChange={(e) => set('elegibilidade', e.target.value)} />
        </Field>
        <Field label="Sobre o processo" htmlFor="ed-pr">
          <Textarea id="ed-pr" rows={3} value={form.processo} onChange={(e) => set('processo', e.target.value)} />
        </Field>
        <Field label="Dicas de contemplados" htmlFor="ed-di" hint="Um item por linha.">
          <Textarea id="ed-di" rows={3} value={form.dicas} onChange={(e) => set('dicas', e.target.value)} />
        </Field>
        <Field label="Informações adicionais" htmlFor="ed-ia">
          <Textarea id="ed-ia" rows={2} value={form.infoAdicional} onChange={(e) => set('infoAdicional', e.target.value)} />
        </Field>
        <Field label="Tags relacionadas" htmlFor="ed-tg" hint="Separadas por vírgula.">
          <Input id="ed-tg" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
        </Field>
      </EditorSection>

      <EditorSection title="Recursos online">
        <p style={{ fontSize: 13.5, color: 'var(--muted-foreground)', margin: 0 }}>
          Vídeos, discussões, posts e links úteis. Escolha a plataforma, dê um título e cole o link.
        </p>

        {form.recursos.map((r, i) => (
          <div key={i} className="ap-resource-row" style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1.4fr auto', gap: 10, alignItems: 'center' }}>
            <Select value={r.plataforma} onChange={(e) => setRecurso(i, 'plataforma', e.target.value)}>
              <option value="youtube">YouTube</option>
              <option value="reddit">Reddit</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="website">Website</option>
            </Select>
            <Input value={r.titulo} onChange={(e) => setRecurso(i, 'titulo', e.target.value)} placeholder="Título" />
            <Input type="url" value={r.meta} onChange={(e) => setRecurso(i, 'meta', e.target.value)} placeholder="https://..." />
            <Button variant="ghost" size="icon" aria-label="Remover recurso"
              onClick={() => removeRecurso(i)} style={{ color: 'var(--vermelha)' }}>
              {Ic('trash-2', 'ico-sm')}
            </Button>
          </div>
        ))}
        {form.recursos.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Nenhum recurso adicionado ainda.</p>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" iconLeft={Ic('youtube', 'ico-sm')} onClick={() => addRecurso('youtube')}>Adicionar YouTube</Button>
          <Button variant="outline" size="sm" iconLeft={Ic('message-circle', 'ico-sm')} onClick={() => addRecurso('reddit')}>Adicionar Reddit</Button>
          <Button variant="outline" size="sm" iconLeft={Ic('instagram', 'ico-sm')} onClick={() => addRecurso('instagram')}>Adicionar Instagram</Button>
          <Button variant="outline" size="sm" iconLeft={Ic('link', 'ico-sm')} onClick={() => addRecurso('website')}>Adicionar link</Button>
        </div>
      </EditorSection>

      {/* Sticky action bar */}
      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', gap: 10, alignItems: 'center',
        padding: '14px 16px', background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
      }}>
        {!isNew && <Button variant="ghost" iconLeft={Ic('trash-2', 'ico-sm')} style={{ color: 'var(--vermelha)' }} onClick={() => setConfirm(true)}>Excluir</Button>}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="outline" iconLeft={Ic('save', 'ico-sm')} onClick={() => onSave(form, 'Rascunho')}>Salvar rascunho</Button>
        <Button variant="primary" iconLeft={Ic('send', 'ico-sm')} onClick={() => onSave(form, 'Publicada')}>Publicar</Button>
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)}
        title="Excluir oportunidade?" description="Esta ação não pode ser desfeita."
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button>
          <Button variant="destructive" iconLeft={Ic('trash-2', 'ico-sm')} onClick={() => { setConfirm(false); onDelete(opp); }}>Excluir</Button>
        </>}>
        "{form.titulo || 'Esta oportunidade'}" será removida permanentemente.
      </Dialog>
    </div>
  );
}
