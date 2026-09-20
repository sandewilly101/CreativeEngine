import { useApp } from '../../context/AppContext';
import { percent, number, humanise } from '../../utils/format';
import { Badge } from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

const CATEGORIES = [
  'printer', 'fabricator', 'av', 'equipment', 'freelancer',
  'logistics', 'catering', 'venue', 'other',
];

export default function Suppliers() {
  return (
    <ResourceManager
      title="Suppliers"
      description="Your production network. Vetting and scoring here is what keeps quality consistent when you scale through partners."
      endpoint="/suppliers"
      searchPlaceholder="Search name, contact, capability…"
      defaultSort="name:asc"
      modalSize="lg"
      emptyDescription="Add the printers, fabricators, AV companies and freelancers you rely on."
      filters={[
        { name: 'category', label: 'All categories', options: CATEGORIES.map((c) => ({ value: c, label: humanise(c) })) },
        {
          name: 'status',
          label: 'All statuses',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'probation', label: 'Probation' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'archived', label: 'Archived' },
          ],
        },
        { name: 'is_vetted', label: 'Vetting', options: [{ value: '1', label: 'Vetted' }, { value: '0', label: 'Not vetted' }] },
      ]}
      columns={[
        {
          key: 'name',
          label: 'Supplier',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 'var(--s2)' }}>
                <span className="bold truncate">{row.name}</span>
                {row.is_vetted === 1 && <span className="badge badge-success">Vetted</span>}
              </div>
              <div className="tiny muted truncate">{humanise(row.category)} · {row.city || '—'}</div>
            </div>
          ),
        },
        {
          key: 'contact_name',
          label: 'Contact',
          render: (row) => (
            <div style={{ minWidth: 0 }}>
              <div className="small truncate">{row.contact_name || '—'}</div>
              <div className="tiny muted truncate">{row.phone || row.email || ''}</div>
            </div>
          ),
        },
        {
          key: 'rating',
          label: 'Rating',
          align: 'right',
          render: (row) => {
            const rating = Number(row.rating || 0);
            return rating > 0 ? (
              <span className="bold" style={{
                color: rating >= 4 ? 'var(--success)' : rating >= 3 ? 'var(--warning)' : 'var(--danger)',
              }}>
                {rating.toFixed(1)} / 5
              </span>
            ) : <span className="muted">—</span>;
          },
        },
        {
          key: 'jobs_completed',
          label: 'Jobs',
          align: 'right',
          render: (row) => number(row.jobs_completed),
        },
        {
          key: 'on_time_rate',
          label: 'On time',
          align: 'right',
          render: (row) => (Number(row.on_time_rate) > 0
            ? percent(row.on_time_rate, 0)
            : <span className="muted">—</span>),
        },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Supplier name', required: true },
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          required: true,
          default: 'other',
          options: CATEGORIES.map((c) => ({ value: c, label: humanise(c) })),
        },
        { name: 'contact_name', label: 'Main contact' },
        { name: 'phone', label: 'Phone' },
        { name: 'whatsapp', label: 'WhatsApp' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'address', label: 'Address', type: 'textarea', rows: 2 },
        { name: 'city', label: 'City', default: 'Dar es Salaam' },
        { name: 'tin', label: 'TIN' },
        { name: 'vrn', label: 'VRN' },
        { name: 'capabilities', label: 'What they can do', type: 'textarea', hint: 'Machines, sizes, materials, capacity' },
        {
          name: 'specialties',
          label: 'Specialties',
          type: 'tags',
          hint: 'Comma separated, e.g. large format, UV printing, CNC',
        },
        { name: 'payment_terms_days', label: 'Their payment terms (days)', type: 'number', default: 14 },
        { name: 'bank_details', label: 'Payment details', type: 'textarea', rows: 2 },
        { name: 'is_vetted', label: 'Vetted', type: 'checkbox', hint: 'Only vetted suppliers should take client work' },
        { name: 'vetted_at', label: 'Vetted on', type: 'date', showIf: (f) => f.is_vetted },
        { name: 'rating', label: 'Quality rating (0–5)', type: 'number', hint: 'Your own assessment' },
        { name: 'sla_notes', label: 'Agreed SLA', type: 'textarea', hint: 'Turnaround promises, reprint policy, penalties' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          default: 'active',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'probation', label: 'Probation' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'archived', label: 'Archived' },
          ],
        },
        { name: 'notes', label: 'Internal notes', type: 'textarea' },
      ]}
    />
  );
}
