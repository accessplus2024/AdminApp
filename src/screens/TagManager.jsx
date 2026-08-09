import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Select, Switch } from '../components';
import { Ic } from '../lib/icons';
import {
  TAG_CATEGORIES, archiveOpportunityTag, createOpportunityTag,
  fetchOpportunityTags, updateOpportunityTag,
} from '../lib/tags';

const emptyForm = { name: '', category: 'Tema', description: '', active: true, sort_order: 0 };

export default function TagManager({ onBack, perms, onCatalogChanged }) {
  const [tags, setTags] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = async () => {
    try { setTags(await fetchOpportunityTags()); }
    catch (error) { setNotice({ type: 'error', text: 'Não foi possível carregar as tags. ' + error.message }); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    return tags.filter((tag) => !q || (tag.name + ' ' + tag.category).toLocaleLowerCase('pt-BR').includes(q));
  }, [query, tags]);

  const edit = (tag) => {
    setEditing(tag);
    setForm({
      name: tag.name,
      category: tag.category,
      description: tag.description || '',
      active: tag.active,
      sort_order: tag.sort_order || 0,
    });
  };
  const reset = () => { setEditing(null); setForm(emptyForm); };
  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true); setNotice(null);
    try {
      if (editing) await updateOpportunityTag(editing.id, form);
      else await createOpportunityTag(form);
      setNotice({ type: 'success', text: editing ? 'Tag atualizada.' : 'Tag criada.' });
      reset();
      await load();
      if (editing) await onCatalogChanged?.();
    } catch (error) {
      setNotice({ type: 'error', text: 'Não foi possível salvar a tag. ' + error.message });
    } finally { setBusy(false); }
  };
  const archive = async (tag) => {
    setBusy(true); setNotice(null);
    try {
      await archiveOpportunityTag(tag);
      setNotice({ type: 'success', text: 'Tag arquivada. Ela não aparecerá em novas classificações.' });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: 'Não foi possível arquivar a tag. ' + error.message });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" iconLeft={Ic('arrow-left', 'ico-sm')} onClick={onBack}>Voltar</Button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>Gerenciar tags</h1>
          <p className="card-helper">Mantenha o vocabulário usado pelo catálogo e pelo Sentinel.</p>
        </div>
      </div>
      {notice && <div className={'workflow-notice workflow-notice--' + notice.type}>{notice.text}</div>}
      <div className="tag-manager-grid">
        <Card flat>
          <CardHeader><CardTitle style={{ fontSize: 16 }}>{editing ? 'Editar tag' : 'Criar tag'}</CardTitle></CardHeader>
          <CardBody>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nome" htmlFor="tag-name"><Input id="tag-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Categoria" htmlFor="tag-category"><Select id="tag-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{TAG_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</Select></Field>
              <Field label="Descrição" htmlFor="tag-description"><Input id="tag-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
              <Field label="Ordem" htmlFor="tag-order"><Input id="tag-order" type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></Field>
              <Switch label="Tag ativa" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              <div style={{ display: 'flex', gap: 8 }}>
                {editing && <Button type="button" variant="ghost" onClick={reset}>Cancelar edição</Button>}
                <Button type="submit" variant="primary" disabled={!perms.canWrite || busy || !form.name.trim()}>{busy ? 'Salvando…' : 'Salvar tag'}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
        <Card flat>
          <CardHeader>
            <div><CardTitle style={{ fontSize: 16 }}>Vocabulário</CardTitle><p className="card-helper">{tags.length} tags cadastradas</p></div>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tags" style={{ maxWidth: 240 }} />
          </CardHeader>
          <CardBody className="tag-manager-list">
            {filtered.map((tag) => (
              <article key={tag.id}>
                <div><strong>{tag.name}</strong><span>{tag.category}</span></div>
                <Badge variant={tag.active ? 'success' : 'neutral'}>{tag.active ? 'Ativa' : 'Arquivada'}</Badge>
                <Button variant="ghost" size="sm" onClick={() => edit(tag)} disabled={!perms.canWrite || busy}>Editar</Button>
                {tag.active && <Button variant="ghost" size="sm" onClick={() => archive(tag)} disabled={!perms.canWrite || busy}>Arquivar</Button>}
              </article>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
