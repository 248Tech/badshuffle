import React from 'react';
import DirectoryContactsPage from '../components/DirectoryContactsPage.jsx';
import { api } from '../api.js';

const fields = [
  { name: 'name', label: 'Venue name', placeholder: 'The Willow Barn', required: true },
  { name: 'contact', label: 'Contact', placeholder: 'Venue manager' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'events@venue.com' },
  { name: 'phone', label: 'Phone', placeholder: '(555) 000-0000' },
  { name: 'address', label: 'Address', placeholder: '456 Reception Road', fullWidth: true },
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Load-in notes, restrictions, preferred dock access…', fullWidth: true },
];

export default function VenuesPage() {
  return (
    <DirectoryContactsPage
      title="Venues"
      subtitle="Keep venue contacts, addresses, and the projects tied to each location together."
      searchPlaceholder="Search venues by name, address, contact, phone, or email"
      addLabel="Add Venue"
      emptyMessage="No venues yet. Quotes will create them automatically when venue details are added."
      entityLabel="venue"
      fields={fields}
      listMethod={api.getVenues}
      createMethod={api.createVenue}
      updateMethod={api.updateVenue}
      itemsKey="venues"
      detailFormatter={(venue) => [
        venue.contact ? `Contact: ${venue.contact}` : null,
        venue.email || null,
        venue.phone || null,
        venue.address || null,
        venue.notes || null,
      ]}
    />
  );
}
