import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import styles from './AssociationList.module.css';

export default function AssociationList({ itemId }) {
  const toast = useToast();
  const [associations, setAssociations] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      api.getItem(itemId),
      api.getItems({ hidden: '0' })
    ]).then(([itemData, allData]) => {
      setAssociations(itemData.associations || []);
      setAllItems(allData.items || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [itemId]);

  const assocIds = new Set(associations.map(a => a.id));
  const suggestions = allItems.filter(
    i => i.id !== Number(itemId) && !assocIds.has(i.id) &&
    (!search || i.title.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 10);

  const add = async (childId) => {
    try {
      await api.addAssociation(itemId, childId);
      load();
      toast.success('Association added');
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (childId) => {
    try {
      await api.removeAssociation(itemId, childId);
      load();
      toast.info('Association removed');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className={styles.wrapper}>
      <h4 className={styles.heading}>Associated Items</h4>
      {loading && <div className="spinner" />}
      {!loading && associations.length === 0 && (
        <p className={styles.empty}>No associations yet</p>
      )}
      <div className={styles.list}>
        {associations.map(a => (
          <div key={a.id} className={styles.assocItem}>
            <span>{a.title}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(a.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className={styles.addSection}>
        <input
          type="search"
          placeholder="Find item to associate…"
          aria-label="Find item to associate"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.suggestions}>
          {suggestions.map(i => (
            <div key={i.id} className={styles.suggestion} role="button" tabIndex={0} onClick={() => add(i.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && add(i.id)}>
              {i.title}
              <span className={styles.addHint}>+ Link</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
