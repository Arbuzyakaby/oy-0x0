/* =========================================================================
   OY — данные моделей: единственный источник цен, конфигураций и цветов.
   Конфигураторы, сравнение и витрина берут цифры только отсюда.
   ========================================================================= */

export const PRODUCTS = {
  '0x0': {
    id: '0x0',
    name: 'OY 0X0',
    colors: { red: 'Сигнальный Красный', ice: 'Арктический ледник' },
    defaultColor: 'red',
    configs: [
      { id: '8/128', usd: 449, eur: 539 },
      { id: '12/128', usd: 489, eur: 579 },
      { id: '12/256', usd: 519, eur: 609 },
      { id: '14/512', usd: 639, eur: 729 },
    ],
  },
  pro: {
    id: 'pro',
    name: 'OY 0X0 Pro',
    colors: { emerald: 'Лесной Изумрудный', chernit: 'Чернит', marble: 'Средиземноморский Мрамор' },
    defaultColor: 'emerald',
    configs: [
      { id: '10/256', usd: 749, eur: 859 },
      { id: '16/512', usd: 879, eur: 999 },
      { id: '20/1024', usd: 1049, eur: 1189 },
    ],
    // «Средиземноморский Мрамор» — эксклюзив: только старшие версии и с наценкой
    surcharge: { marble: { usd: 150, eur: 170, configs: ['16/512', '20/1024'] } },
  },
};

export function getConfig(productId, configId) {
  return PRODUCTS[productId]?.configs.find((c) => c.id === configId) ?? null;
}

export function colorAvailable(productId, configId, colorId) {
  const s = PRODUCTS[productId]?.surcharge?.[colorId];
  return !s || s.configs.includes(configId);
}

export function getPrice(productId, configId, colorId) {
  const cfg = getConfig(productId, configId);
  if (!cfg || !colorAvailable(productId, configId, colorId)) return null;
  const s = PRODUCTS[productId].surcharge?.[colorId];
  return { usd: cfg.usd + (s?.usd ?? 0), eur: cfg.eur + (s?.eur ?? 0) };
}
