import { computed, inject, provide, reactive, ref, type InjectionKey } from 'vue';
import type { Category, Idea, IdeaStatus } from '../../../features/coforge/domain/types';
import { rankedIdeas, STATUS_LABELS } from '../../../features/coforge/domain/types';
import { requestCategoryNames } from '../../../features/coforge/domain/request-categories';
import { useStudioStore } from '../../stores/coforge-studio';
import { contributorName } from './format';
import { projectWorkSummary } from './project-work-summary';

export type BoardFilter = 'all' | 'review' | 'flagged' | 'rejected';
export type BoardSort = 'rice' | 'votes' | 'newest';
export type BoardLayout = 'board' | 'list';

interface ColumnDefinition { title: string; hint: string; statuses: readonly IdeaStatus[]; icon: string; tone: string }

const COLUMNS: readonly ColumnDefinition[] = [
  { title: 'Inbox', hint: 'Listen & screen', statuses: ['inbox', 'screened', 'flagged'], icon: 'inbox', tone: 'inbox' },
  { title: 'Up next', hint: 'Ranked & planned', statuses: ['ranked', 'planned'], icon: 'sparkles', tone: 'next' },
  { title: 'In progress', hint: 'Build & review', statuses: ['building', 'review'], icon: 'circle-dot', tone: 'progress' },
  { title: 'Accepted', hint: 'Community contributions', statuses: ['shipped'], icon: 'check-check', tone: 'done' },
];
const ARCHIVE_COLUMN: ColumnDefinition = { title: 'Archived', hint: 'Ideas kept for context', statuses: ['rejected'], icon: 'inbox', tone: 'inbox' };

export const SORT_OPTIONS: ReadonlyArray<{ value: BoardSort; label: string }> = [
  { value: 'rice', label: 'RICE priority' }, { value: 'votes', label: 'Most votes' }, { value: 'newest', label: 'Newest first' },
];

const matchesFilter = (idea: Idea, filter: BoardFilter): boolean => (filter === 'all' ? idea.status !== 'rejected' : idea.status === filter);

/** Filter, search, sort and layout state of the idea board plus the projections its parts render. */
function createBoard() {
  const store = useStudioStore();
  const query = ref('');
  const filter = ref<BoardFilter>('all');
  const category = ref<Category | ''>('');
  const layout = ref<BoardLayout>('board');
  const sort = ref<BoardSort>('rice');
  const requestKind = ref<'all' | 'feature' | 'bug'>('all');

  const ideas = computed(() => store.projectIdeas);
  const contributors = computed(() => store.state?.contributors ?? []);
  const countOf = (status: IdeaStatus) => ideas.value.filter(idea => idea.status === status).length;
  const authorOf = (idea: Idea) => contributors.value.find(person => person.id === idea.authorId)?.name ?? '';

  const filtered = computed<Idea[]>(() => {
    const needle = query.value.toLowerCase();
    const source = ideas.value.filter(idea => matchesFilter(idea, filter.value)
      && (requestKind.value === 'all' || (idea.requestKind ?? 'feature') === requestKind.value)
      && (!category.value || idea.category === category.value)
      && (!needle || `${idea.id} ${idea.title} ${idea.description} ${authorOf(idea)}`.toLowerCase().includes(needle)));
    if (sort.value === 'rice') return rankedIdeas(source);
    return source.sort((a, b) => (sort.value === 'votes' ? b.voters.length - a.voters.length : b.createdAt.localeCompare(a.createdAt)));
  });
  const isFiltered = computed(() => Boolean(query.value) || Boolean(category.value) || filter.value !== 'all' || requestKind.value !== 'all');

  const tabs = computed(() => ([
    { key: 'all', label: 'All requests', count: ideas.value.filter(idea => idea.status !== 'rejected').length },
    { key: 'review', label: 'Needs review', count: countOf('review') },
    { key: 'flagged', label: 'Flagged', count: countOf('flagged') },
    { key: 'rejected', label: 'Archived', count: countOf('rejected') },
  ] as const).map(tab => ({ ...tab, selected: filter.value === tab.key, highlight: tab.key === 'review' && tab.count > 0 })));

  const columns = computed(() => (filter.value === 'rejected' ? [ARCHIVE_COLUMN] : COLUMNS)
    .map(column => ({
      ...column,
      ideas: filtered.value.filter(idea => column.statuses.includes(idea.status)),
      canAdd: column.title === 'Inbox',
      emptyText: isFiltered.value ? 'No matching requests' : 'No requests',
    })));

  const rows = computed(() => filtered.value.map(idea => ({
    id: idea.id, title: idea.title, status: idea.status, statusLabel: STATUS_LABELS[idea.status],
    contributor: contributorName(contributors.value, idea.authorId), votes: idea.voters.length, rice: idea.rice?.score ?? '—',
  })));

  return reactive({
    store, query, filter, category, layout, sort, requestKind, filtered, isFiltered, tabs, columns, rows,
    summary: computed(() => projectWorkSummary(store.state)),
    categories: computed(() => [...new Set([...requestCategoryNames(store.activeProject?.settings.requestObject), ...ideas.value.map(idea => idea.category)])]), sortOptions: SORT_OPTIONS,
    projectEmpty: computed(() => ideas.value.length === 0),
    emptyTitle: computed(() => (isFiltered.value ? 'No ideas match this view.' : 'Your next game starts with an idea.')),
    emptyText: computed(() => (isFiltered.value ? 'Try a different search or filter.' : 'Submit an idea here, or type !request in the stream chat.')),
    emptyAction: computed(() => (isFiltered.value ? 'Clear filters' : 'Add the first idea')),
    setFilter: (next: BoardFilter) => { filter.value = next; },
    showDecision: (next: 'review' | 'flagged') => {
      query.value = ''; category.value = ''; requestKind.value = 'all'; filter.value = next;
    },
    setLayout: (next: BoardLayout) => { layout.value = next; },
    clearQuery: () => { query.value = ''; },
    startNew: () => { store.creating = true; },
    open: (id: string) => { store.select(id); },
    resolveEmpty: () => {
      if (!isFiltered.value) { store.creating = true; return; }
      filter.value = 'all'; category.value = ''; query.value = ''; requestKind.value = 'all';
    },
  });
}

export type BoardModel = ReturnType<typeof createBoard>;
const BOARD_KEY: InjectionKey<BoardModel> = Symbol('coforge-board');

/** Root binding of the idea board; shares its state with the toolbar, kanban and table. */
export function useIdeaBoard(): BoardModel {
  const board = createBoard();
  provide(BOARD_KEY, board);
  return board;
}

/** The board state of the enclosing `IdeaBoard`. */
export function useBoardView(): BoardModel {
  const board = inject(BOARD_KEY, null);
  if (!board) throw new Error('Board parts must render inside IdeaBoard.');
  return board;
}
