'use client';

import { useState, useEffect, useCallback } from 'react';
import { PriceAlertStorage, PriceAlert } from '@/lib/price-alerts';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';

interface PriceAlertManagerProps {
  onAlertTriggered?: (alerts: PriceAlert[]) => void;
}

const SNOOZE_DURATION = 30 * 60 * 1000; // 30 minutes

function sendBrowserNotification(alert: PriceAlert) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification('Stellar-Spend Price Alert', {
      body: `${alert.currency} rate is now ${alert.alertType} ${alert.targetPrice}`,
      icon: '/icons/icon-192x192.png',
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') sendBrowserNotification(alert);
    });
  }
}

export function PriceAlertManager({ onAlertTriggered }: PriceAlertManagerProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    currency: 'NGN',
    targetPrice: '',
    alertType: 'above' as 'above' | 'below',
  });

  const refresh = useCallback(() => setAlerts(PriceAlertStorage.getAllAlerts()), []);

  useEffect(() => {
    refresh();

    const getPrices = async () => {
      try {
        const res = await fetch('/api/offramp/rate');
        const data = await res.json();
        return { [data.currency]: data.rate } as Record<string, number>;
      } catch {
        return {};
      }
    };

    PriceAlertStorage.startMonitoring((triggered) => {
      refresh();
      triggered.forEach(a => {
        const snoozeExpiry = snoozedUntil[a.id];
        if (!snoozeExpiry || Date.now() > snoozeExpiry) {
          sendBrowserNotification(a);
        }
      });
      onAlertTriggered?.(triggered);
    }, getPrices);

    return () => PriceAlertStorage.stopMonitoring();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAlertTriggered]);

  const handleCreate = () => {
    if (!formData.targetPrice) return;
    PriceAlertStorage.createAlert({
      currency: formData.currency,
      targetPrice: parseFloat(formData.targetPrice),
      alertType: formData.alertType,
      status: 'active',
    });
    refresh();
    setFormData({ currency: 'NGN', targetPrice: '', alertType: 'above' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    PriceAlertStorage.deleteAlert(id);
    refresh();
  };

  const handleToggle = (id: string, currentStatus: string) => {
    PriceAlertStorage.updateAlert(id, {
      status: currentStatus === 'active' ? 'inactive' : 'active',
    } as Partial<PriceAlert>);
    refresh();
  };

  const handleSnooze = (id: string) => {
    const until = Date.now() + SNOOZE_DURATION;
    setSnoozedUntil(prev => ({ ...prev, [id]: until }));
    // Re-activate so it can trigger again after snooze
    PriceAlertStorage.updateAlert(id, { status: 'active', notificationSent: false } as Partial<PriceAlert>);
    refresh();
  };

  const activeAlerts = alerts.filter(a => a.status !== 'triggered');
  const history = alerts.filter(a => a.status === 'triggered');
  const triggeredCount = history.length;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Price Alerts</h3>
        {triggeredCount > 0 && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            {triggeredCount} triggered
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        {(['active', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-1 text-sm capitalize ${activeTab === tab ? 'border-b-2 border-blue-600 font-medium' : 'text-gray-500'}`}
          >
            {tab} {tab === 'history' && triggeredCount > 0 ? `(${triggeredCount})` : ''}
          </button>
        ))}
      </div>

      {activeTab === 'active' && (
        <>
          <div className="space-y-2 mb-4">
            {activeAlerts.length === 0 && (
              <p className="text-sm text-gray-500">No active alerts.</p>
            )}
            {activeAlerts.map(alert => {
              const isSnoozed = snoozedUntil[alert.id] && Date.now() < snoozedUntil[alert.id];
              return (
                <div key={alert.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {alert.currency} {alert.alertType === 'above' ? '≥' : '≤'} {alert.targetPrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isSnoozed ? `Snoozed until ${new Date(snoozedUntil[alert.id]).toLocaleTimeString()}` : (
                        <span className={alert.status === 'active' ? 'text-green-600' : 'text-gray-400'}>
                          {alert.status}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button onClick={() => handleToggle(alert.id, alert.status)} variant="secondary" size="sm">
                      {alert.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                    <Button onClick={() => handleSnooze(alert.id)} variant="secondary" size="sm" title="Snooze 30 min">
                      💤
                    </Button>
                    <button onClick={() => handleDelete(alert.id)} className="text-red-500 hover:text-red-700 px-1 text-sm">✕</button>
                  </div>
                </div>
              );
            })}
          </div>

          {showForm ? (
            <div className="space-y-2">
              <select
                value={formData.currency}
                onChange={e => setFormData({ ...formData, currency: e.target.value })}
                className="w-full p-2 border rounded text-sm"
              >
                <option value="NGN">NGN</option>
                <option value="KES">KES</option>
                <option value="GHS">GHS</option>
              </select>
              <select
                value={formData.alertType}
                onChange={e => setFormData({ ...formData, alertType: e.target.value as 'above' | 'below' })}
                className="w-full p-2 border rounded text-sm"
              >
                <option value="above">Rate goes above</option>
                <option value="below">Rate goes below</option>
              </select>
              <input
                type="number"
                placeholder="Target Rate"
                value={formData.targetPrice}
                onChange={e => setFormData({ ...formData, targetPrice: e.target.value })}
                className="w-full p-2 border rounded text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleCreate}>Create Alert</Button>
                <Button onClick={() => setShowForm(false)} variant="secondary">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowForm(true)}>+ New Alert</Button>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-gray-500">No triggered alerts yet.</p>
          )}
          {history.map(alert => (
            <div key={alert.id} className="flex justify-between items-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {alert.currency} {alert.alertType === 'above' ? '≥' : '≤'} {alert.targetPrice.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  Triggered {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : '—'}
                </p>
              </div>
              <button onClick={() => handleDelete(alert.id)} className="text-red-500 hover:text-red-700 px-1 text-sm">✕</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
