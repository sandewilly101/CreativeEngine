import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useApp } from '../context/AppContext';
import {
  Card, Button, DataTable, Pagination, SearchInput, Modal,
  ConfirmDialog, Field, Input, Textarea, Select, Empty, Badge,
} from './UI';
import MediaPicker from './MediaPicker';
import ImageField from './ImageField';
import ListEditor from './ListEditor';
import CardList from './CardList';

/**
 * A complete admin CRUD screen driven by a field schema.
 *
 * Most admin resources differ only in their columns and form fields, so this
 * component owns the shared behaviour — listing, searching, filtering,
 * paging, create/edit modal, delete confirmation, bulk actions and the trash
 * view — and each page supplies only its schema.
 */
export default function ResourceManager({
  title,
  description,
  endpoint,
  columns,
  fields,
  filters = [],
  searchPlaceholder = 'Search…',
  defaultSort,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  emptyTitle,
  emptyDescription,
  onRowClick,
  transformBeforeSave,
  extraActions,
  hideHeading = false,
  modalSize = '',
  pageSize = 25,
  // Visual content reads better as cards than as table rows; `card` maps a
  // record to {image, title, subtitle, meta, badge, dimmed}.
  layout = 'table',
  card,
  reorderable = false,
  viewUrl,
}) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [showTrash, setShowTrash] = useState(false);
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState([]);

  const { toast } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = api.qs({
        page,
        limit: pageSize,
        search,
        sort: defaultSort,
        trashed: showTrash ? 'true' : undefined,
        ...filterValues,
      });
      const res = await api.get(`${endpoint}${qs}`);
      setRows(res.data || []);
      setPagination(res.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      toast(err.message, 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, search, defaultSort, showTrash, filterValues, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterValues, showTrash]);

  const openCreate = () => {
    const blank = {};
    for (const field of fields) {
      blank[field.name] = field.default
        ?? (field.type === 'checkbox' ? 0 : field.type === 'list' ? [] : '');
    }
    setForm(blank);
    setEditing({ isNew: true });
    setFormError('');
  };

  const openEdit = async (row) => {
    try {
      // Fetch the full record: list views often omit long fields.
      const res = await api.get(`${endpoint}/${row.id}`);
      const record = res.data || row;
      const populated = {};
      for (const field of fields) {
        let value = record[field.name];
        if (value === null || value === undefined) {
          value = field.default ?? (field.type === 'list' ? [] : '');
        }
        if (field.type === 'json' && typeof value === 'object') value = JSON.stringify(value, null, 2);
        // A list column may still hold a JSON string on older records.
        if (field.type === 'list' && typeof value === 'string') {
          try { value = JSON.parse(value); } catch { value = []; }
          if (!Array.isArray(value)) value = [];
        }
        populated[field.name] = value;
      }
      setForm(populated);
      setEditing(record);
      setFormError('');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const save = async () => {
    setSaving(true);
    setFormError('');
    try {
      let payload = { ...form };

      // Coerce types the API expects.
      for (const field of fields) {
        const value = payload[field.name];
        if (field.type === 'number' || field.type === 'money') {
          payload[field.name] = value === '' ? null : Number(value);
        } else if (field.type === 'checkbox') {
          payload[field.name] = value ? 1 : 0;
        } else if (field.type === 'json') {
          if (typeof value === 'string' && value.trim()) {
            try { payload[field.name] = JSON.parse(value); } catch {
              throw new Error(`${field.label} is not valid JSON`);
            }
          } else if (!value) {
            payload[field.name] = null;
          }
        } else if (field.type === 'list') {
          // Half-typed rows are dropped rather than saved as empty entries —
          // an empty string in a deliverables list renders as a stray bullet.
          const items = (Array.isArray(value) ? value : []).filter((item) => (
            typeof item === 'string'
              ? item.trim() !== ''
              : item && Object.values(item).some((v) => v !== '' && v !== null && v !== undefined)
          ));
          payload[field.name] = items.length ? items : null;
        } else if (field.type === 'tags') {
          payload[field.name] = typeof value === 'string'
            ? value.split(',').map((t) => t.trim()).filter(Boolean)
            : value;
        } else if (value === '') {
          payload[field.name] = null;
        }
      }

      if (transformBeforeSave) payload = transformBeforeSave(payload, editing);

      if (editing.isNew) {
        await api.post(endpoint, payload);
        toast(`${title.replace(/s$/, '')} created`, 'success');
      } else {
        await api.patch(`${endpoint}/${editing.id}`, payload);
        toast('Saved', 'success');
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`${endpoint}/${deleting.id}${showTrash ? '?permanent=true' : ''}`);
      toast(showTrash ? 'Permanently deleted' : 'Moved to trash', 'success');
      setDeleting(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
      setDeleting(null);
    }
  };

  const restore = async (row) => {
    try {
      await api.post(`${endpoint}/${row.id}/restore`);
      toast('Restored', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  /**
   * Move a card one place up or down.
   *
   * Swapping just the two rows' sort_order values is not enough: seeded
   * records often share a value (frequently all zero), and swapping 0 with 0
   * changes nothing while swapping 0 with 1 can throw the row to the far end
   * of a tied list. So the whole visible page is renumbered from its new
   * order instead, which is correct whatever state the values were in.
   *
   * The local array is updated first — waiting for the round trip makes each
   * click feel broken.
   */
  const move = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;

    const previous = rows;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);

    try {
      // Offset by the page so ordering stays stable across pagination.
      const base = (pagination.page - 1) * pageSize;
      await api.post(`${endpoint}/reorder`, {
        items: next.map((row, i) => ({ id: row.id, sort_order: base + i + 1 })),
      });
      load();
    } catch (err) {
      toast(err.message, 'error');
      setRows(previous);
    }
  };

  const bulkDelete = async () => {
    try {
      await api.post(`${endpoint}/bulk/delete`, { ids: selected });
      toast(`${selected.length} deleted`, 'success');
      setSelected([]);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const tableColumns = [
    ...columns,
    {
      key: '_actions',
      label: '',
      width: 120,
      render: (row) => (
        <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          {showTrash ? (
            <Button size="sm" variant="outline" onClick={() => restore(row)}>Restore</Button>
          ) : (
            <>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>}
              {canDelete && (
                <Button size="sm" variant="ghost" onClick={() => setDeleting(row)} style={{ color: 'var(--danger)' }}>
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="stack-lg">
      <div className="row-between row-wrap">
        <div>
          {/* Nested inside a page that already has a heading, the title would
              be a second <h2> saying almost the same thing. */}
          {!hideHeading && <h2>{title}</h2>}
          {description && <p className="muted small">{description}</p>}
        </div>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          {extraActions}
          <Button
            variant={showTrash ? 'dark' : 'outline'}
            size="sm"
            onClick={() => setShowTrash((v) => !v)}
          >
            {showTrash ? 'Back to list' : 'Trash'}
          </Button>
          {canCreate && !showTrash && (
            <Button variant="primary" onClick={openCreate}>+ New</Button>
          )}
        </div>
      </div>

      <Card>
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} />

          <div className="row row-wrap" style={{ gap: 'var(--s2)' }}>
            {filters.map((filter) => (
              <select
                key={filter.name}
                className="select"
                value={filterValues[filter.name] || ''}
                onChange={(e) => setFilterValues((v) => ({ ...v, [filter.name]: e.target.value }))}
                style={{ width: 'auto', minWidth: 130 }}
              >
                <option value="">{filter.label}</option>
                {filter.options.map((opt) => (
                  <option key={opt.value ?? opt} value={opt.value ?? opt}>
                    {opt.label ?? opt}
                  </option>
                ))}
              </select>
            ))}

            {selected.length > 0 && (
              <Button variant="danger" size="sm" onClick={bulkDelete}>
                Delete {selected.length}
              </Button>
            )}
          </div>
        </div>

        {layout === 'cards' && card ? (
          <CardList
            rows={rows}
            loading={loading}
            card={card}
            onEdit={openEdit}
            onDelete={setDeleting}
            onRestore={restore}
            onMove={move}
            viewUrl={viewUrl}
            showTrash={showTrash}
            canEdit={canEdit}
            canDelete={canDelete}
            // Reordering only makes sense against the sort column it writes to.
            reorderable={reorderable && !showTrash && !search && defaultSort?.startsWith('sort_order')}
            empty={
              <Empty
                title={showTrash ? 'Trash is empty' : (emptyTitle || `No ${title.toLowerCase()} yet`)}
                description={showTrash ? undefined : emptyDescription}
                action={canCreate && !showTrash ? <Button variant="primary" onClick={openCreate}>Create the first one</Button> : undefined}
              />
            }
          />
        ) : (
          <DataTable
            columns={tableColumns}
            rows={rows}
            loading={loading}
            onRowClick={onRowClick}
            selectable={canDelete && !showTrash}
            selected={selected}
            onSelect={setSelected}
            empty={
              <Empty
                title={showTrash ? 'Trash is empty' : (emptyTitle || `No ${title.toLowerCase()} yet`)}
                description={showTrash ? undefined : emptyDescription}
                action={canCreate && !showTrash ? <Button variant="primary" onClick={openCreate}>Create the first one</Button> : undefined}
              />
            }
          />
        )}

        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          onChange={setPage}
        />
      </Card>

      {/* ---------------------------------------------------- EDIT / CREATE */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size={modalSize}
        title={editing?.isNew ? `New ${title.replace(/s$/, '').toLowerCase()}` : `Edit ${title.replace(/s$/, '').toLowerCase()}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        {formError && <div className="alert alert-danger" style={{ marginBottom: 'var(--s5)' }}>{formError}</div>}

        {fields.map((field) => {
          if (field.showIf && !field.showIf(form)) return null;

          const value = form[field.name] ?? '';
          const update = (next) => setForm((f) => ({ ...f, [field.name]: next }));

          if (field.type === 'checkbox') {
            return (
              <label key={field.name} className="checkbox-row" style={{ marginBottom: 'var(--s5)' }}>
                <input type="checkbox" checked={!!value} onChange={(e) => update(e.target.checked ? 1 : 0)} />
                <span>
                  <span className="bold small">{field.label}</span>
                  {field.hint && <div className="tiny muted">{field.hint}</div>}
                </span>
              </label>
            );
          }

          if (field.type === 'media') {
            // Images get the drag-and-drop field; video and documents keep
            // the library picker, where choosing an existing file is the norm.
            const kind = field.mediaKind || 'image';
            return (
              <Field key={field.name} label={field.label} hint={field.hint}>
                {kind === 'image' ? (
                  <ImageField value={value} onChange={update} ratio={field.ratio} />
                ) : (
                  <MediaPicker value={value} onChange={update} kind={kind} />
                )}
              </Field>
            );
          }

          if (field.type === 'list') {
            return (
              <Field key={field.name} label={field.label} hint={field.hint}>
                <ListEditor
                  value={value}
                  onChange={update}
                  itemFields={field.itemFields}
                  addLabel={field.addLabel}
                  placeholder={field.placeholder}
                />
              </Field>
            );
          }

          return (
            <Field key={field.name} label={field.label} required={field.required} hint={field.hint}>
              {field.type === 'textarea' || field.type === 'json' ? (
                <Textarea
                  value={value}
                  onChange={(e) => update(e.target.value)}
                  rows={field.rows || (field.type === 'json' ? 6 : 4)}
                  placeholder={field.placeholder}
                  style={field.type === 'json' ? { fontFamily: 'ui-monospace, monospace', fontSize: 13 } : undefined}
                />
              ) : field.type === 'select' ? (
                <Select
                  value={value}
                  onChange={(e) => update(e.target.value)}
                  placeholder={field.placeholder || 'Select…'}
                  options={field.options || []}
                />
              ) : field.type === 'tags' ? (
                <Input
                  value={Array.isArray(value) ? value.join(', ') : value}
                  onChange={(e) => update(e.target.value)}
                  placeholder={field.placeholder || 'Comma separated'}
                />
              ) : (
                <Input
                  type={field.type === 'money' ? 'number' : (field.type || 'text')}
                  value={value}
                  onChange={(e) => update(e.target.value)}
                  placeholder={field.placeholder}
                  step={field.type === 'money' ? 1 : undefined}
                />
              )}
            </Field>
          );
        })}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={showTrash ? 'Delete permanently?' : 'Move to trash?'}
        message={
          showTrash
            ? 'This permanently removes the record. It cannot be undone.'
            : 'You can restore this from the trash later.'
        }
        confirmLabel={showTrash ? 'Delete permanently' : 'Move to trash'}
      />
    </div>
  );
}
