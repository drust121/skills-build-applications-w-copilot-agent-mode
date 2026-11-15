import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type WorkoutSuggestion = { _id?: string; title: string; focus?: string; reason: string };
type WorkoutState =
  | { status: 'loading' }
  | { status: 'loaded'; suggestions: WorkoutSuggestion[] }
  | { status: 'error'; message: string };

const userEmail = 'mona@example.com';

export default function Workouts() {
  const [state, setState] = useState<WorkoutState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    getJson<{ suggestions: WorkoutSuggestion[] }>(`/api/workouts/suggestions/${encodeURIComponent(userEmail)}`)
      .then(({ suggestions }) => {
        if (active) setState({ status: 'loaded', suggestions });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load workout suggestions.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">Workout suggestions</h2>
        <p>Recommend workouts from activity patterns.</p>
        {state.status === 'loading' && <p role="status">Loading workout suggestions...</p>}
        {state.status === 'error' && <p role="alert">Unable to load workout suggestions: {state.message}</p>}
        {state.status === 'loaded' && state.suggestions.length === 0 && <p>No workout suggestions available.</p>}
        {state.status === 'loaded' && state.suggestions.length > 0 && (
          <ul className="list-group">
            {state.suggestions.map((suggestion, index) => (
              <li className="list-group-item" key={suggestion._id ?? `${suggestion.title}-${index}`}>
                <strong>{suggestion.title}</strong>
                {suggestion.focus && <> — {suggestion.focus}</>}: {suggestion.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
