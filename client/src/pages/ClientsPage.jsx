import React from 'react';
import DirectoryContactsPage from '../components/DirectoryContactsPage.jsx';
import { api } from '../api.js';

const fields = [
  { name: 'first_name', label: 'First name', placeholder: 'Jordan', required: true },
  { name: 'last_name', label: 'Last name', placeholder: 'Rivera' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'client@example.com' },
  { name: 'phone', label: 'Phone', placeholder: '(555) 000-0000' },
  { name: 'address', label: 'Address', placeholder: '123 Event Lane', fullWidth: true },
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'VIP preferences, preferred contact method, house rules…', fullWidth: true },
];

export default function ClientsPage() {
  return (
    <DirectoryContactsPage
      title="Clients"
      subtitle="Track client contact details and jump back into past orders from one place."
      searchPlaceholder="Search clients by name, email, phone, or address"
      addLabel="Add Client"
      emptyMessage="No clients yet. New quotes will create them automatically, or you can add one here."
      entityLabel="client"
      fields={fields}
      listMethod={api.getClients}
      createMethod={api.createClient}
      updateMethod={api.updateClient}
      itemsKey="clients"
      detailFormatter={(client) => [
        [client.first_name, client.last_name].filter(Boolean).join(' ').trim() || null,
        client.email || null,
        client.phone || null,
        client.address || null,
        client.notes || null,
      ]}
    />
  );
}
