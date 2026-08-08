import { useMemo, useState } from 'react';
import { Button, Input } from './index';
import { Ic } from '../lib/icons';
import { normalizeTagNames } from '../lib/tags';

export default function TagSelector({ tags = [], value = [], onChange, disabled = false }) {
  const [query, setQuery] = useState('');
  const selected = normalizeTagNames(value);
  const selectedKeys = new Set(selected.map((name) => name.toLocaleLowerCase('pt-BR')));
  const options = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    return tags
      .filter((tag) => tag.active !== false && !selectedKeys.has(tag.name.toLocaleLowerCase('pt-BR')))
      .filter((tag) => !q || (tag.name + ' ' + tag.category).toLocaleLowerCase('pt-BR').includes(q))
      .slice(0, 16);
  }, [query, selectedKeys, tags]);

  const add = (name) => {
    onChange(normalizeTagNames([...selected, name]));
    setQuery('');
  };
  const remove = (name) => onChange(selected.filter((item) => item !== name));

  return (
    <div className="tag-selector">
      <div className="tag-selector__selected" aria-label="Tags selecionadas">
        {selected.map((name) => (
          <span className="tag-selector__chip" key={name}>
            {name}
            <button type="button" onClick={() => remove(name)} disabled={disabled} aria-label={'Remover tag ' + name}>
              {Ic('x', 'ico-xs')}
            </button>
          </span>
        ))}
        {selected.length === 0 && <small>Nenhuma tag selecionada.</small>}
      </div>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar uma tag" disabled={disabled} />
      {query.trim() && (
        <div className="tag-selector__options">
          {options.length > 0 ? options.map((tag) => (
            <Button type="button" variant="ghost" size="sm" key={tag.id || tag.name} onClick={() => add(tag.name)}>
              {tag.name} <small>{tag.category}</small>
            </Button>
          )) : <small>Nenhuma tag ativa encontrada.</small>}
        </div>
      )}
    </div>
  );
}
