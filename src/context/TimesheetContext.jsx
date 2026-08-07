import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase, useSupabase } from '../lib/api';
import { api } from '../lib/api';

const TimesheetContext = createContext(null);

const STORAGE_KEY = 'vcc_timesheets';
const FREEZE_KEY = 'vcc_frozen_periods';

function loadLocal(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

export function TimesheetProvider({ children }) {
  const [timesheets, setTimesheets] = useState({});
  const [frozenPeriods, setFrozenPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Load data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      if (useSupabase && supabase) {
        try {
          // Fetch all timesheets with entries
          const { data: tsData } = await supabase
            .from('timesheets')
            .select('*, timesheet_entries(*)');

          const tsMap = {};
          for (const ts of tsData || []) {
            const key = `${ts.user_id}__${ts.period_label}`;
            tsMap[key] = {
              id: ts.id,
              entries: (ts.timesheet_entries || []).map(e => ({
                date: e.date,
                dayName: e.day_name,
                workItem: e.work_item || '',
                description: e.description || '',
                hours: e.hours || 0,
              })),
              status: ts.status || 'saved',
              totalHours: ts.total_hours || 0,
              updatedAt: ts.updated_at,
              userId: ts.user_id,
              userName: ts.user_name,
              userProject: ts.user_project,
              periodLabel: ts.period_label,
            };
          }
          setTimesheets(tsMap);

          // Fetch frozen periods
          const { data: frozenData } = await supabase
            .from('frozen_periods')
            .select('*');
          const frozenKeys = (frozenData || []).map(f =>
            `${f.period_label}__${f.project || 'ALL'}`
          );
          setFrozenPeriods(frozenKeys);

          // Deprecated projects to hide
          const DEPRECATED_PROJECTS = ['VCC - Integration', 'VCC - Zendesk'];

          // Fetch all users (include archived and inactive so counts are consistent)
          const { data: usersData } = await supabase
            .from('users')
            .select('*')
            .order('name');
          // Normalize project names (trim whitespace) and filter deprecated
          const normalizedUsers = (usersData || []).map(u => ({
            ...u,
            role: u.role === 'consolidator' ? 'admin' : u.role,
            project: u.project ? u.project.trim() : u.project,
            is_archived: u.is_archived || false,
          })).filter(u => !DEPRECATED_PROJECTS.includes(u.project));
          setEmployees(normalizedUsers);

          // Extract unique projects
          const uniqueProjects = [...new Set(normalizedUsers.map(u => u.project).filter(Boolean))].sort();
          setProjects(uniqueProjects);
        } catch (err) {
          console.error('Failed to load from Supabase:', err);
          // Fallback to localStorage
          setTimesheets(loadLocal(STORAGE_KEY, {}));
          setFrozenPeriods(loadLocal(FREEZE_KEY, []));
        }
      } else {
        setTimesheets(loadLocal(STORAGE_KEY, {}));
        setFrozenPeriods(loadLocal(FREEZE_KEY, []));
      }
      setLoaded(true);
    }
    loadData();
  }, []);

  // Persist to localStorage as backup
  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(timesheets));
  }, [timesheets, loaded]);

  useEffect(() => {
    if (loaded) localStorage.setItem(FREEZE_KEY, JSON.stringify(frozenPeriods));
  }, [frozenPeriods, loaded]);

  const getTimesheetKey = (userId, periodLabel) => `${userId}__${periodLabel}`;

  const saveTimesheet = useCallback(async (userId, periodLabel, entries, status = 'saved') => {
    const key = getTimesheetKey(userId, periodLabel);

    // Update local state immediately
    setTimesheets((prev) => ({
      ...prev,
      [key]: { entries, status, updatedAt: new Date().toISOString() },
    }));

    // Persist to Supabase
    if (useSupabase && supabase) {
      try {
        await api.post('/timesheets', { userId, periodLabel, entries, status });
      } catch (err) {
        console.error('Failed to save to Supabase:', err);
      }
    }
  }, []);

  const submitTimesheet = useCallback(async (userId, periodLabel) => {
    const key = getTimesheetKey(userId, periodLabel);
    setTimesheets((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      return {
        ...prev,
        [key]: { ...existing, status: 'submitted', updatedAt: new Date().toISOString() },
      };
    });

    if (useSupabase && supabase) {
      try {
        await api.put(`/timesheets/submit`, { userId, periodLabel });
      } catch (err) {
        console.error('Failed to submit to Supabase:', err);
      }
    }
  }, []);

  const getTimesheet = useCallback(
    (userId, periodLabel) => {
      const key = getTimesheetKey(userId, periodLabel);
      return timesheets[key] || null;
    },
    [timesheets]
  );

  const getUserTimesheets = useCallback(
    (userId) => {
      const prefix = `${userId}__`;
      const result = {};
      Object.entries(timesheets).forEach(([key, val]) => {
        if (key.startsWith(prefix)) {
          result[key.replace(prefix, '')] = val;
        }
      });
      return result;
    },
    [timesheets]
  );

  const getAllTimesheets = useCallback(() => timesheets, [timesheets]);

  const freezePeriod = useCallback(async (periodLabel, project) => {
    const key = `${periodLabel}__${project || 'ALL'}`;
    setFrozenPeriods((prev) => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });

    if (useSupabase && supabase) {
      try {
        await api.post('/frozen-periods', { periodLabel, project: project || null });
      } catch (err) {
        console.error('Failed to freeze period:', err);
      }
    }
  }, []);

  const isPeriodFrozen = useCallback(
    (periodLabel, project) => {
      const key = `${periodLabel}__${project || 'ALL'}`;
      return frozenPeriods.includes(key);
    },
    [frozenPeriods]
  );

  const updateEmployee = useCallback(async (employeeId, fields) => {
    // Update local state immediately
    setEmployees(prev => prev.map(e =>
      e.id === employeeId ? { ...e, ...fields } : e
    ));

    // Persist to Supabase
    if (useSupabase && supabase) {
      try {
        await supabase
          .from('users')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', employeeId);
      } catch (err) {
        console.error('Failed to update employee:', err);
      }
    }
  }, []);

  const archiveEmployee = useCallback(async (employeeId, archive = true) => {
    // Update local state immediately
    setEmployees(prev => prev.map(e =>
      e.id === employeeId ? { ...e, is_archived: archive } : e
    ));

    // Persist to Supabase
    if (useSupabase && supabase) {
      try {
        await supabase
          .from('users')
          .update({ is_archived: archive, updated_at: new Date().toISOString() })
          .eq('id', employeeId);
      } catch (err) {
        console.error('Failed to archive employee:', err);
        // Revert on failure
        setEmployees(prev => prev.map(e =>
          e.id === employeeId ? { ...e, is_archived: !archive } : e
        ));
      }
    }
  }, []);

  return (
    <TimesheetContext.Provider
      value={{
        saveTimesheet,
        submitTimesheet,
        getTimesheet,
        getUserTimesheets,
        getAllTimesheets,
        freezePeriod,
        isPeriodFrozen,
        updateEmployee,
        archiveEmployee,
        frozenPeriods,
        employees,
        projects,
        loaded,
      }}
    >
      {children}
    </TimesheetContext.Provider>
  );
}

export function useTimesheets() {
  const ctx = useContext(TimesheetContext);
  if (!ctx) throw new Error('useTimesheets must be used within TimesheetProvider');
  return ctx;
}
