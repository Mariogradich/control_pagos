import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client.js';

/**
 * Hook que carga la lista de eventos y la expone a las vistas.
 * `reload()` permite volver a consultar tras una mutacion (CRUD de eventos).
 */
export function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/events');
      setEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false; // evita setState sobre componentes desmontados

    api
      .get('/events')
      .then((data) => !cancelled && setEvents(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return { events, loading, error, reload: load };
}
