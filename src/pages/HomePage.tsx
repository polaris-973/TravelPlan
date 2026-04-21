import { useState, useCallback } from 'react';
import { Settings, Plus, Calendar, Layers, ChevronUp, MapPin, AlertCircle, Sparkles } from 'lucide-react';
import { LeafletMapView } from '../components/Map/LeafletMapView';
import { PersistentSheet, ModalSheet } from '../components/common/BottomSheet';
import { DaySchedule } from '../components/BottomSheet/DaySchedule';
import { SearchBar } from '../components/Search/SearchBar';
import { PlaceDetail } from '../components/PlaceCard/PlaceDetail';
import { AssistantButton } from '../components/Assistant/AssistantButton';
import { ToastContainer, useToast } from '../components/common/Toast';
import { SettingsPage } from '../components/Settings/SettingsPage';
import { PlanningIntakeSheet } from '../components/Planning/PlanningIntakeSheet';
import { PlanSelector } from '../components/Planning/PlanSelector';
import { PlanRefineChat } from '../components/Planning/PlanRefineChat';
import { HotelManager } from '../components/Home/HotelManager';
import type { SavedPlan } from '../types/trip';
import { useTripStore, categoryFromType } from '../store/tripStore';
import { useSettingsStore } from '../store/settingsStore';
import type { PlaceVisit, NoteColor, NoteMood } from '../types/trip';
import type { PoiResult } from '../services/amap/loader';

const PEEK_HEIGHT = 76;

export function HomePage() {
  const [showSettings, setShowSettings] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);
  const [refineTarget, setRefineTarget] = useState<SavedPlan | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceVisit | null>(null);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite'>('standard');

  const trip = useTripStore((s) => s.getActiveTrip());
  const { addPlaceToDay, removePlace, updatePlace, undoDelete, addDay, setDayWeather, addNote, removeNote, updateNote } = useTripStore();
  const config = useSettingsStore((s) => s.config);
  const { toasts, show: showToast, dismiss } = useToast();

  const allPlaces = trip?.days.flatMap((d) => d.places) ?? [];
  const currentDayId = activeDayId ?? trip?.days[0]?.id ?? null;

  // ── Map display: filter places to the active day and label them accordingly ──
  const { mapPlaces, placeLabels, dayGroups } = (() => {
    if (!trip || trip.days.length === 0) {
      return { mapPlaces: [] as PlaceVisit[], placeLabels: undefined, dayGroups: undefined };
    }

    // If an active day is explicitly chosen → show only that day's places numbered 1..N
    const activeDay = activeDayId ? trip.days.find((d) => d.id === activeDayId) : null;
    if (activeDay) {
      const labels: Record<string, string> = {};
      activeDay.places.forEach((p, i) => { labels[p.id] = String(i + 1); });
      return {
        mapPlaces: activeDay.places,
        placeLabels: labels,
        dayGroups: [{ dayIndex: trip.days.indexOf(activeDay), placeIds: activeDay.places.map((p) => p.id) }],
      };
    }

    // No specific day → overview of all days, each pin labelled "D{day}-{stop}"
    const labels: Record<string, string> = {};
    const groups: Array<{ dayIndex: number; placeIds: string[] }> = [];
    const allOrdered: PlaceVisit[] = [];
    trip.days.forEach((day, dIdx) => {
      if (day.places.length === 0) return;
      groups.push({ dayIndex: dIdx, placeIds: day.places.map((p) => p.id) });
      day.places.forEach((p, pIdx) => {
        labels[p.id] = `D${dIdx + 1}-${pIdx + 1}`;
        allOrdered.push(p);
      });
    });
    return { mapPlaces: allOrdered, placeLabels: labels, dayGroups: groups };
  })();

  // Find the day that contains the selected place
  const selectedDay = selectedPlace
    ? trip?.days.find((d) => d.places.some((p) => p.id === selectedPlace.id)) ?? null
    : null;
  const selectedDayId = selectedDay?.id ?? null;
  const selectedDayDate = selectedDay?.date ?? '';

  const handleSelectPOI = useCallback((poi: PoiResult) => {
    if (poi.id.startsWith('__')) {
      if (poi.id === '__no_key__') showToast('请先在设置中填写高德地图 API Key', 'error');
      return;
    }
    if (!trip) { showToast('请先创建行程', 'info'); return; }

    let targetDayId = currentDayId;
    if (!targetDayId) {
      addDay(trip.id);
      targetDayId = useTripStore.getState().getActiveTrip()?.days[0]?.id ?? null;
    }
    if (!targetDayId) return;

    addPlaceToDay(trip.id, targetDayId, {
      placeId: poi.id,
      name: poi.name,
      location: poi.location,
      category: categoryFromType(poi.type),
      address: poi.address,
      durationMinutes: 90,
      priority: 'want',
      notes: [],
      photos: [],
      ticketRequired: false,
      rating: poi.rating,
    });

    const days = useTripStore.getState().getActiveTrip()?.days ?? [];
    const dayIndex = (days.findIndex((d) => d.id === targetDayId) ?? 0) + 1;
    showToast(`已添加"${poi.name}"到第 ${dayIndex} 天`, 'success');
  }, [trip, currentDayId, addPlaceToDay, addDay, showToast]);

  const handleDeletePlace = useCallback((dayId: string, placeId: string, placeName: string) => {
    if (!trip) return;
    removePlace(trip.id, dayId, placeId);
    showToast(`已删除"${placeName}"`, 'undo', undoDelete);
  }, [trip, removePlace, showToast, undoDelete]);

  if (showSettings) {
    return <SettingsPage onBack={() => setShowSettings(false)} />;
  }

  const hasAmapKey = !!config.amapApiKey;

  // Keep selectedPlace in sync after updates
  const handlePlaceUpdate = (patch: Partial<PlaceVisit>) => {
    if (!trip || !selectedPlace || !selectedDayId) return;
    updatePlace(trip.id, selectedDayId, selectedPlace.id, patch);
    setSelectedPlace((p) => p ? { ...p, ...patch } : p);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: 'var(--color-bg)' }}>

      {/* ── Map — always full screen ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: PEEK_HEIGHT, zIndex: 0 }}>
        <LeafletMapView
          places={mapPlaces}
          hotels={trip?.hotels ?? []}
          onMarkerClick={(place) => setSelectedPlace(place)}
          selectedPlaceId={selectedPlace?.id}
          mapLayer={mapLayer}
          placeLabels={placeLabels}
          dayGroups={dayGroups}
        />
      </div>

      {/* ── API Key missing banner ── */}
      {!hasAmapKey && (
        <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 72px)', left: 16, right: 16, zIndex: 25, borderRadius: 14, overflow: 'hidden' }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: 'rgba(200, 90, 62, 0.92)', backdropFilter: 'blur(12px)' }}>
            <AlertCircle size={15} strokeWidth={1.5} className="text-white flex-shrink-0" />
            <span className="text-[13px] text-white flex-1">未配置高德 API Key — 搜索功能不可用</span>
            <button className="tap text-[12px] font-semibold text-white underline" onClick={() => setShowSettings(true)}>去设置</button>
          </div>
        </div>
      )}

      {/* ── Top floating controls ── */}
      <div style={{
        position: 'absolute',
        left: 'max(12px, env(safe-area-inset-left))',
        right: 'max(12px, env(safe-area-inset-right))',
        zIndex: 20,
        top: 'calc(var(--safe-top) + 10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {/* min-width:0 is critical — flex items with input children refuse to shrink without it */}
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <SearchBar onSelectPlace={handleSelectPOI} />
          </div>
          {trip && (
            <button
              className="tap glass-light"
              title="AI 智能规划"
              style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', flexShrink: 0, background: 'linear-gradient(135deg,rgba(58,122,140,0.15),rgba(44,95,107,0.15))', border: '1px solid rgba(58,122,140,0.2)' }}
              onClick={() => setShowPlanning(true)}
            >
              <Sparkles size={17} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
            </button>
          )}
          <button className="tap glass-light" style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', flexShrink: 0 }} onClick={() => setShowSettings(true)}>
            <Settings size={17} strokeWidth={1.5} style={{ color: 'var(--color-text)' }} />
          </button>
          <button className="tap glass-light" title="切换图层" style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', flexShrink: 0 }} onClick={() => setMapLayer(mapLayer === 'standard' ? 'satellite' : 'standard')}>
            <Layers size={17} strokeWidth={1.5} style={{ color: 'var(--color-text)' }} />
          </button>
        </div>

        {trip && (trip.savedPlans?.length ?? 0) > 0 && (
          <PlanSelector
            trip={trip}
            onCreateNew={() => setShowPlanning(true)}
            onRefinePlan={(p) => setRefineTarget(p)}
          />
        )}

        {trip && trip.days.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }} className="scroll-ios">
            <button
              className="tap"
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                whiteSpace: 'nowrap',
                background: activeDayId === null
                  ? 'linear-gradient(135deg, rgba(58,122,140,0.85), rgba(44,95,107,0.85))'
                  : 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: activeDayId === null ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.70)',
                color: activeDayId === null ? 'white' : 'var(--color-text)',
              }}
              onClick={() => setActiveDayId(null)}
            >
              全部
            </button>
            {trip.days.map((day, i) => (
              <button key={day.id} className="tap" style={{
                flexShrink: 0, padding: '6px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                whiteSpace: 'nowrap',
                background: day.id === activeDayId
                  ? 'linear-gradient(135deg, rgba(58,122,140,0.85), rgba(44,95,107,0.85))'
                  : 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: day.id === activeDayId
                  ? '1px solid rgba(255,255,255,0.35)'
                  : '1px solid rgba(255,255,255,0.70)',
                boxShadow: day.id === activeDayId
                  ? '0 2px 12px rgba(58,122,140,0.30)'
                  : '0 2px 8px rgba(0,0,0,0.08)',
                color: day.id === activeDayId ? 'white' : 'var(--color-text)',
              }} onClick={() => setActiveDayId(day.id)}>
                D{i + 1}{day.places.length > 0 ? ` · ${day.places.length}` : ''}
              </button>
            ))}
            <button className="tap glass-light" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }} onClick={() => trip && addDay(trip.id)}>
              <Plus size={15} strokeWidth={2} style={{ color: 'var(--color-primary)' }} />
            </button>
          </div>
        )}
      </div>

      {/* ── Persistent bottom sheet ── */}
      <PersistentSheet peekHeight={PEEK_HEIGHT} snapPoints={[0.46, 0.92]} defaultSnap={0}>
        {(expanded) => (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {!expanded && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={14} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{trip ? trip.title : '还没有行程'}</span>
                  {allPlaces.length > 0 && <span className="pill badge-nature" style={{ fontSize: 11 }}>{allPlaces.length} 个地点</span>}
                </div>
                <ChevronUp size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
              </div>
            )}

            {expanded && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }} className="scroll-ios">
                {!trip ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                    <span style={{ fontSize: 40, marginBottom: 12 }}>✈️</span>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: 'var(--color-text)' }}>还没有行程</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: 220 }}>用顶部搜索栏添加地点，或问 AI 助手帮你规划</p>
                  </div>
                ) : trip.days.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
                    <span style={{ fontSize: 40, marginBottom: 12 }}>🗺️</span>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: 'var(--color-text)' }}>行程还是空的</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: 220, marginBottom: 16 }}>搜索地点后会自动创建第 1 天</p>
                    <button className="tap" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 14, backgroundColor: 'var(--color-primary)', color: 'white', fontSize: 13, fontWeight: 600 }} onClick={() => addDay(trip.id)}>
                      <Calendar size={14} strokeWidth={1.5} />手动新建第 1 天
                    </button>
                  </div>
                ) : (
                  <>
                    {trip.days
                      .filter((d) => activeDayId === null || d.id === activeDayId)
                      .map((day) => (
                        <DaySchedule
                          key={day.id}
                          day={day}
                          dayIndex={trip.days.indexOf(day)}
                          onPlaceDelete={(placeId) => {
                            const p = day.places.find((pl) => pl.id === placeId);
                            handleDeletePlace(day.id, placeId, p?.name ?? '');
                          }}
                          onPlacePress={(place) => setSelectedPlace(place)}
                          onPlaceDurationChange={(placeId, minutes) => updatePlace(trip.id, day.id, placeId, { durationMinutes: minutes })}
                          onAddPlace={() => setActiveDayId(day.id)}
                          onWeatherFetched={(weather) => setDayWeather(trip.id, day.id, weather)}
                        />
                      ))}
                    <HotelManager trip={trip} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </PersistentSheet>

      {/* ── Place detail modal ── */}
      <ModalSheet isOpen={!!selectedPlace} onClose={() => setSelectedPlace(null)} snapPoints={[0.70, 0.95]} defaultSnap={0}>
        {selectedPlace && (
          <PlaceDetail
            place={selectedPlace}
            dayDate={selectedDayDate}
            onClose={() => setSelectedPlace(null)}
            onUpdate={handlePlaceUpdate}
            onAddNote={(content: string, color: NoteColor, mood?: NoteMood) => {
              if (!trip || !selectedDayId) return;
              addNote(trip.id, selectedDayId, selectedPlace.id, { content, color, mood });
              // Sync local state
              const freshPlace = useTripStore.getState().getActiveTrip()
                ?.days.find((d) => d.id === selectedDayId)
                ?.places.find((p) => p.id === selectedPlace.id);
              if (freshPlace) setSelectedPlace(freshPlace);
            }}
            onRemoveNote={(noteId: string) => {
              if (!trip || !selectedDayId) return;
              removeNote(trip.id, selectedDayId, selectedPlace.id, noteId);
              setSelectedPlace((p) => p ? { ...p, notes: p.notes.filter((n) => n.id !== noteId) } : p);
            }}
            onUpdateNote={(noteId: string, patch) => {
              if (!trip || !selectedDayId) return;
              updateNote(trip.id, selectedDayId, selectedPlace.id, noteId, patch);
              setSelectedPlace((p) => p ? { ...p, notes: p.notes.map((n) => n.id === noteId ? { ...n, ...patch } : n) } : p);
            }}
          />
        )}
      </ModalSheet>

      {/* ── AI Assistant FAB ── */}
      <AssistantButton />

      {/* ── Planning Intake Sheet ── */}
      {trip && (
        <PlanningIntakeSheet
          isOpen={showPlanning}
          trip={trip}
          onClose={() => {
            setShowPlanning(false);
            setActiveDayId(null);
          }}
        />
      )}

      {/* ── Plan Refine Chat ── */}
      {trip && refineTarget && (
        <PlanRefineChat
          isOpen={!!refineTarget}
          trip={trip}
          basePlan={refineTarget}
          onClose={() => {
            setRefineTarget(null);
            setActiveDayId(null);
          }}
        />
      )}

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
