/**
 * 主页酒店管理 — 独立于 AI 规划的酒店录入/显示
 * 酒店会作为地图 marker 显示，也会作为 LLM 规划的可选参考
 */
import { useState } from 'react';
import { Hotel as HotelIcon, Plus, Trash2, MapPin } from 'lucide-react';
import type { Trip, Hotel, Location } from '../../types/trip';
import { useTripStore } from '../../store/tripStore';
import { useSettingsStore } from '../../store/settingsStore';
import { geocode } from '../../services/amap/loader';

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

interface Props {
  trip: Trip;
}

export function HotelManager({ trip }: Props) {
  const { addHotel, removeHotel } = useTripStore();
  const apiKey = useSettingsStore((s) => s.config.amapApiKey);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    checkInDate: trip.startDate,
    checkOutDate: trip.endDate,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hotels = trip.hotels ?? [];

  const reset = () => {
    setForm({
      name: '',
      address: '',
      checkInDate: trip.startDate,
      checkOutDate: trip.endDate,
      notes: '',
    });
    setError(null);
    setAdding(false);
    setSubmitting(false);
  };

  const submit = async () => {
    if (!form.name.trim()) { setError('请填写酒店名'); return; }
    if (!form.checkInDate || !form.checkOutDate) { setError('请选择入住和退房日期'); return; }
    if (new Date(form.checkOutDate) <= new Date(form.checkInDate)) { setError('退房日期须晚于入住日期'); return; }

    setSubmitting(true);
    setError(null);

    let location: Location = { lng: 0, lat: 0 };
    if (form.address.trim() && apiKey) {
      const coords = await geocode(apiKey, form.address.trim());
      if (coords) location = coords;
    }

    const hotel: Hotel = {
      id: nanoid(),
      name: form.name.trim(),
      location,
      address: form.address.trim() || undefined,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      notes: form.notes.trim() || undefined,
    };
    addHotel(trip.id, hotel);
    reset();
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <HotelIcon size={14} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>我的酒店</span>
          {hotels.length > 0 && <span className="text-[11px] text-muted">· {hotels.length} 家</span>}
        </div>
        {!adding && (
          <button
            className="tap flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{ backgroundColor: 'rgba(58,122,140,0.1)', color: 'var(--color-primary)' }}
            onClick={() => setAdding(true)}
          >
            <Plus size={11} strokeWidth={2} />添加
          </button>
        )}
      </div>

      {hotels.length === 0 && !adding && (
        <div className="text-[11px] text-muted text-center py-3">
          还没有酒店 · 订好后添加到这里，AI 规划时可作为参考
        </div>
      )}

      {hotels.map((h) => (
        <div
          key={h.id}
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-1.5"
          style={{ backgroundColor: 'rgba(107,127,168,0.08)' }}
        >
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-lg"
            style={{ background: 'linear-gradient(135deg,#6B7FA8,#4A6080)', fontSize: 14 }}
          >
            🏨
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }}>{h.name}</div>
            {h.address && (
              <div className="flex items-center gap-1 text-[11px] text-muted truncate">
                <MapPin size={9} strokeWidth={1.5} />{h.address}
              </div>
            )}
            <div className="text-[11px] text-muted">
              {h.checkInDate} → {h.checkOutDate}
            </div>
          </div>
          <button
            className="tap w-6 h-6 flex items-center justify-center flex-shrink-0 rounded-full"
            style={{ backgroundColor: 'rgba(200,90,62,0.08)' }}
            onClick={() => removeHotel(trip.id, h.id)}
          >
            <Trash2 size={11} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
          </button>
        </div>
      ))}

      {adding && (
        <div
          className="rounded-xl p-3 mt-1.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.7)', border: '1px solid var(--color-divider)' }}
        >
          <div className="text-[12px] text-muted mb-1">酒店名 *</div>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none mb-2"
            style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
            placeholder="如：丽江花间堂"
          />
          <div className="text-[12px] text-muted mb-1">地址（可选，有助于显示在地图上）</div>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none mb-2"
            style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
            placeholder="如：丽江市古城区新华街"
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="text-[12px] text-muted mb-1">入住 *</div>
              <input
                type="date"
                value={form.checkInDate}
                onChange={(e) => setForm({ ...form, checkInDate: e.target.value })}
                className="w-full px-2 py-2 rounded-lg text-[12px] outline-none"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
              />
            </div>
            <div>
              <div className="text-[12px] text-muted mb-1">退房 *</div>
              <input
                type="date"
                value={form.checkOutDate}
                onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })}
                className="w-full px-2 py-2 rounded-lg text-[12px] outline-none"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
              />
            </div>
          </div>
          <div className="text-[12px] text-muted mb-1">备注</div>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none mb-2"
            style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
            placeholder="如：已付款订单号 xxxx"
          />
          {error && <div className="text-[11px] text-accent mb-2">{error}</div>}
          <div className="flex gap-2">
            <button
              className="tap flex-1 py-2 rounded-lg text-[12px]"
              style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text-secondary)' }}
              onClick={reset}
              disabled={submitting}
            >
              取消
            </button>
            <button
              className="tap flex-1 py-2 rounded-lg text-[12px] font-semibold text-white"
              style={{ backgroundColor: submitting ? 'var(--color-text-tertiary)' : 'var(--color-primary)' }}
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
