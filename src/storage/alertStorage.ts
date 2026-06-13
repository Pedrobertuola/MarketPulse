import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AlertRule } from '../types';

const ALERT_RULES_STORAGE_KEY = '@marketpulse/alert-rules';

export async function getAlertRules(): Promise<AlertRule[]> {
  const storedValue = await AsyncStorage.getItem(ALERT_RULES_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    return JSON.parse(storedValue) as AlertRule[];
  } catch {
    return [];
  }
}

export async function saveAlertRules(alertRules: AlertRule[]): Promise<void> {
  await AsyncStorage.setItem(
    ALERT_RULES_STORAGE_KEY,
    JSON.stringify(alertRules)
  );
}

export async function getAlertRulesByAsset(
  assetId: string
): Promise<AlertRule[]> {
  const alertRules = await getAlertRules();
  return alertRules.filter((alertRule) => alertRule.assetId === assetId);
}

export async function addAlertRule(
  alertRule: Omit<AlertRule, 'id' | 'createdAt'>
): Promise<AlertRule[]> {
  const alertRules = await getAlertRules();
  const nextAlertRule: AlertRule = {
    ...alertRule,
    id: `${alertRule.assetId}-${alertRule.type}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const updatedAlertRules = [...alertRules, nextAlertRule];

  await saveAlertRules(updatedAlertRules);
  return updatedAlertRules;
}

export async function removeAlertRule(alertRuleId: string): Promise<AlertRule[]> {
  const alertRules = await getAlertRules();
  const updatedAlertRules = alertRules.filter(
    (alertRule) => alertRule.id !== alertRuleId
  );

  await saveAlertRules(updatedAlertRules);
  return updatedAlertRules;
}
