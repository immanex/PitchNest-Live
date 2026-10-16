import { useState } from 'react';
import { SectionHeader, SettingRow, SettingsGroup, Toggle, usePersistSettings, useStoredUser } from './shared';

type NotificationKey =
  | 'pitchAlerts'
  | 'weeklyReport'
  | 'trialLifecycle'
  | 'businessActivity'
  | 'followedUpdates'
  | 'followedFounders'
  | 'communityReplies'
  | 'investorInquiries';

// In-app ecosystem notifications are on unless the user turns them off; the
// server treats a missing key as on too.
const DEFAULTS: Record<NotificationKey, boolean> = {
  pitchAlerts: true,
  weeklyReport: false,
  trialLifecycle: true,
  businessActivity: true,
  followedUpdates: true,
  followedFounders: true,
  communityReplies: true,
  investorInquiries: true,
};

const EMAIL: { key: NotificationKey; label: string; description: string }[] = [
  { key: 'pitchAlerts', label: 'Pitch analysis alerts', description: 'When your pitch analysis is ready.' },
  { key: 'weeklyReport', label: 'Weekly progress report', description: 'A summary of your improvement and deck views.' },
  { key: 'trialLifecycle', label: 'Trial and plan emails', description: 'Reminders before your trial ends and news about plan changes.' },
];

const IN_APP: { key: NotificationKey; label: string; description: string }[] = [
  { key: 'businessActivity', label: 'Questions on my businesses', description: 'Someone comments on a business you manage.' },
  { key: 'followedUpdates', label: 'Businesses I follow', description: 'A business you follow posts an update or milestone.' },
  { key: 'followedFounders', label: 'Founders I follow', description: 'A founder you follow posts an update or joins a new business.' },
  { key: 'communityReplies', label: 'Replies to my discussions', description: 'Someone replies to a discussion you started.' },
  { key: 'investorInquiries', label: 'Investor inquiries', description: 'An investor requests access.' },
];

export default function NotificationsSection() {
  const user = useStoredUser();
  const persist = usePersistSettings();
  const [values, setValues] = useState<Record<NotificationKey, boolean>>(() => ({
    ...DEFAULTS,
    ...(user.settings?.notifications && typeof user.settings.notifications === 'object' ? user.settings.notifications : {}),
  }));

  const set = (key: NotificationKey, checked: boolean) => {
    const next = { ...values, [key]: checked };
    setValues(next);
    void persist({ notifications: next });
  };

  const rows = (list: typeof EMAIL) =>
    list.map((item) => (
      <SettingRow key={item.key} label={item.label} description={item.description}>
        <Toggle checked={values[item.key]} onChange={(checked) => set(item.key, checked)} label={item.label} />
      </SettingRow>
    ));

  return (
    <>
      <SectionHeader title="Notifications" description="Choose what we tell you about, and where." />
      <SettingsGroup title="Email">{rows(EMAIL)}</SettingsGroup>
      <SettingsGroup title="In the app">{rows(IN_APP)}</SettingsGroup>
    </>
  );
}
