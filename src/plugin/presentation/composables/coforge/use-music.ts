import { computed, onBeforeUnmount, reactive } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useMusicStore } from "../../stores/coforge-music";
import type { MusicActions } from "../../../features/coforge/application/music-ports";
import type { MusicTrack } from "../../../features/coforge/domain/music";
import { emptyMusic } from "../../../features/coforge/domain/music";
import { useTemporaryExample } from "./use-temporary-example";
export function useMusic() {
  const { host } = useCoforge();
  const store = useMusicStore();
  let unsubscribe = () => {};
  let closed = false;
  const actions = (): MusicActions | undefined =>
    store.example ? host.previewMusic?.() : host.music;
  function connect() {
    unsubscribe();
    const service = actions();
    if (!service) return;
    store.state = service.snapshot();
    if (!store.folder) store.folder = store.state.library.folder;
    unsubscribe = service.subscribe((state) => {
      if (!closed) {
        if (store.folder === store.state.library.folder)
          store.folder = state.library.folder;
        store.state = state;
      }
    });
  }
  connect();
  onBeforeUnmount(() => {
    closed = true;
    unsubscribe();
  });
  async function run(work: (service: MusicActions) => Promise<void>) {
    const service = actions();
    if (!service) return;
    store.error = "";
    store.notice = "";
    try {
      await work(service);
    } catch (error) {
      if (!closed)
        store.error =
          error instanceof Error
            ? error.message
            : "Music could not be updated.";
    }
  }
  const title = (id: string) =>
    store.state.library.tracks.find((track) => track.id === id)?.title ??
    `${id.split("/").pop()} · missing`;
  const choose = () => {
    const playlist = store.state.library.playlists.find(
      (item) => item.id === store.selected,
    );
    store.name = playlist?.name ?? "";
    store.tracks = [...(playlist?.tracks ?? [])];
    store.version = playlist?.version;
  };
  const playback = computed(() => store.state.playback);
  const current = computed(() =>
    store.state.library.tracks.find(
      (track) => track.id === playback.value.queue[playback.value.index],
    ),
  );
  const time = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const number = (event: Event) =>
    event.target instanceof HTMLInputElement ? Number(event.target.value) : 0;
  const exitExample = () => {
    if (!store.example) return;
    const previous = actions();
    unsubscribe();
    store.example = false;
    store.state = emptyMusic();
    store.folder = "";
    store.selected = "";
    store.name = "";
    store.tracks = [];
    store.version = undefined;
    store.search = "";
    store.error = "";
    store.notice = "";
    void previous?.stop().catch(() => {
      store.error = "The example player could not be stopped.";
    });
    host.discardPreview?.("music");
  };
  const beginExample = useTemporaryExample("music", exitExample);
  return reactive({
    store,
    playback,
    preparedPlaylist: computed(() =>
      store.state.library.playlists.find(
        (item) => item.id === store.state.selectedPlaylistId,
      ),
    ),
    playPrepared: () => {
      const id = store.state.selectedPlaylistId;
      if (id) void run((service) => service.playPlaylist(id));
    },
    current,
    title,
    time,
    choose,
    available: computed(() => Boolean(actions())),
    canPreview: Boolean(host.previewMusic),
    library: computed(() =>
      store.state.library.tracks.filter((track) =>
        `${track.title} ${track.artist}`
          .toLowerCase()
          .includes(store.search.toLowerCase()),
      ),
    ),
    missing: computed(
      () =>
        store.tracks.filter(
          (id) => !store.state.library.tracks.some((track) => track.id === id),
        ).length,
    ),
    busy: computed(() => store.state.busy),
    preview: () => {
      if (host.music || store.state.busy) return;
      beginExample();
      store.example = true;
      connect();
      void run((service) => service.refresh());
    },
    exitExample,
    refresh: () => {
      void run((service) => service.refresh());
    },
    configure: (event: Event) => {
      event.preventDefault();
      void run(async (service) => {
        await service.configure(store.folder);
        store.selected = "";
        choose();
        store.notice = "Music folder saved. Existing files were not moved.";
      });
    },
    metadata: (track: MusicTrack) => {
      void run((service) => service.openMetadata(track.id));
    },
    add: (track: MusicTrack) => {
      if (store.tracks.length < 500) store.tracks.push(track.id);
    },
    remove: (index: number) => {
      store.tracks.splice(index, 1);
    },
    move: (index: number, by: -1 | 1) => {
      const target = index + by;
      if (target < 0 || target >= store.tracks.length) return;
      const [id] = store.tracks.splice(index, 1);
      if (id) store.tracks.splice(target, 0, id);
    },
    save: (event: Event) => {
      event.preventDefault();
      void run(async (service) => {
        const previous = new Set(
          store.state.library.playlists.map((item) => item.id),
        );
        await service.savePlaylist({
          id: store.selected,
          name: store.name,
          tracks: [...store.tracks],
          version: store.version,
        });
        if (!store.selected)
          store.selected =
            service
              .snapshot()
              .library.playlists.find((item) => !previous.has(item.id))?.id ??
            "";
        choose();
        store.notice = "Playlist saved as a Markdown note.";
      });
    },
    play: () => {
      void run((service) => service.playPlaylist(store.selected));
    },
    pause: () => {
      void run((service) => service.pause());
    },
    resume: () => {
      void run((service) => service.resume());
    },
    stop: () => {
      void run((service) => service.stop());
    },
    skip: (by: -1 | 1) => {
      void run((service) => service.skip(by));
    },
    seek: (event: Event) => {
      void run((service) => service.seek(number(event)));
    },
    volume: (event: Event) => {
      void run((service) => service.volume(number(event) / 100));
    },
  });
}
