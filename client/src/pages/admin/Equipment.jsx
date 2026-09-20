import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { money, number } from '../../utils/format';
import { Badge } from '../../components/UI';
import ResourceManager from '../../components/ResourceManager';

export default function Equipment() {
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const { currency } = useApp();

  useEffect(() => {
    Promise.all([
      api.get('/equipment-categories?limit=50').catch(() => ({ data: [] })),
      api.get('/suppliers?limit=100').catch(() => ({ data: [] })),
    ]).then(([c, s]) => {
      setCategories(c.data || []);
      setSuppliers(s.data || []);
    });
  }, []);

  return (
    <ResourceManager
      title="Equipment"
      description="Your hire fleet. Utilisation drives the decision to buy rather than keep renting in."
      endpoint="/bookings/equipment"
      searchPlaceholder="Search name or SKU…"
      defaultSort="name:asc"
      modalSize="lg"
      emptyDescription="Add the equipment you own or regularly source, with its daily rate."
      filters={[
        {
          name: 'category_id',
          label: 'All categories',
          options: categories.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          name: 'status',
          label: 'All statuses',
          options: [
            { value: 'available', label: 'Available' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'retired', label: 'Retired' },
            { value: 'draft', label: 'Draft' },
          ],
        },
        {
          name: 'ownership',
          label: 'All ownership',
          options: [
            { value: 'owned', label: 'Owned' },
            { value: 'supplier', label: 'Supplier sourced' },
            { value: 'consignment', label: 'Consignment' },
          ],
        },
      ]}
      columns={[
        {
          key: 'name',
          label: 'Item',
          render: (row) => (
            <div className="row" style={{ gap: 'var(--s3)' }}>
              {row.cover_thumb ? (
                <img src={row.cover_thumb} alt="" style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover',
                }} />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                  background: 'var(--ink-100)', display: 'grid', placeItems: 'center',
                }}>▣</div>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="bold truncate">{row.name}</div>
                <div className="tiny muted mono">{row.sku}</div>
              </div>
            </div>
          ),
        },
        { key: 'category_name', label: 'Category', render: (row) => <span className="small">{row.category_name || '—'}</span> },
        {
          key: 'daily_rate_cents',
          label: 'Day rate',
          align: 'right',
          render: (row) => (
            <div>
              <div className="bold">{money(row.daily_rate_cents, currency)}</div>
              {row.unit_of_measure === 'sqm' && <div className="tiny muted">per sqm</div>}
            </div>
          ),
        },
        {
          key: 'total_units',
          label: 'Units',
          align: 'right',
          render: (row) => number(row.total_units),
        },
        {
          key: 'utilisation_days',
          label: 'Days hired',
          align: 'right',
          render: (row) => (
            <span className="small" title="Lifetime days on hire">
              {number(row.utilisation_days)}
            </span>
          ),
        },
        {
          key: 'ownership',
          label: 'Ownership',
          render: (row) => (
            <Badge tone={row.ownership === 'owned' ? 'success' : 'neutral'}>
              {row.ownership === 'owned' ? 'Owned' : row.supplier_name || 'Supplier'}
            </Badge>
          ),
        },
        { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
      ]}
      fields={[
        { name: 'name', label: 'Equipment name', required: true },
        { name: 'sku', label: 'SKU', required: true, hint: 'Your internal code, e.g. LED-P39-IN' },
        {
          name: 'category_id',
          label: 'Category',
          type: 'select',
          options: categories.map((c) => ({ value: c.id, label: c.name })),
        },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'cover_media_id', label: 'Photo', type: 'media' },
        {
          name: 'specifications',
          label: 'Specifications',
          type: 'json',
          hint: 'Array of {"label": "...", "value": "..."} shown on the public page',
          placeholder: '[{"label":"Pixel pitch","value":"3.9mm"}]',
        },
        { name: 'total_units', label: 'Units owned', type: 'number', default: 1, required: true },
        {
          name: 'unit_of_measure',
          label: 'Priced by',
          type: 'select',
          default: 'unit',
          options: [
            { value: 'unit', label: 'Per unit' },
            { value: 'sqm', label: 'Per square metre' },
            { value: 'metre', label: 'Per metre' },
            { value: 'set', label: 'Per set' },
          ],
          hint: 'LED walls are normally priced per square metre per day',
        },
        { name: 'daily_rate_cents', label: 'Daily rate (cents)', type: 'money', required: true },
        { name: 'half_day_rate_cents', label: 'Half day rate (cents)', type: 'money' },
        { name: 'weekly_rate_cents', label: 'Weekly rate (cents)', type: 'money', hint: 'Applied automatically when it beats the daily rate' },
        { name: 'deposit_cents', label: 'Deposit (cents)', type: 'money' },
        { name: 'replacement_value_cents', label: 'Replacement value (cents)', type: 'money', hint: 'Used to track payback against hire revenue' },
        { name: 'min_rental_days', label: 'Minimum hire days', type: 'number', default: 1 },
        { name: 'requires_operator', label: 'Needs a technician', type: 'checkbox' },
        { name: 'operator_day_rate_cents', label: 'Technician day rate (cents)', type: 'money', showIf: (f) => f.requires_operator },
        { name: 'requires_transport', label: 'Needs transport', type: 'checkbox' },
        { name: 'transport_cents', label: 'Transport charge (cents)', type: 'money', showIf: (f) => f.requires_transport },
        { name: 'power_requirement', label: 'Power requirement' },
        { name: 'dimensions', label: 'Dimensions' },
        { name: 'weight_kg', label: 'Weight (kg)', type: 'number' },
        {
          name: 'ownership',
          label: 'Ownership',
          type: 'select',
          default: 'owned',
          options: [
            { value: 'owned', label: 'We own it' },
            { value: 'supplier', label: 'Sourced from a supplier' },
            { value: 'consignment', label: 'On consignment' },
          ],
        },
        {
          name: 'supplier_id',
          label: 'Supplier',
          type: 'select',
          showIf: (f) => f.ownership !== 'owned',
          options: suppliers.map((s) => ({ value: s.id, label: s.name })),
        },
        { name: 'supplier_cost_cents', label: 'Our cost per day (cents)', type: 'money', showIf: (f) => f.ownership !== 'owned' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          default: 'available',
          options: [
            { value: 'available', label: 'Available' },
            { value: 'maintenance', label: 'In maintenance' },
            { value: 'retired', label: 'Retired' },
            { value: 'draft', label: 'Draft' },
          ],
        },
        { name: 'is_published', label: 'Show on the public site', type: 'checkbox', default: 1 },
        { name: 'is_featured', label: 'Feature it', type: 'checkbox' },
        { name: 'condition_notes', label: 'Condition notes', type: 'textarea' },
      ]}
    />
  );
}
