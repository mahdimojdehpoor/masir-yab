// کمک‌کننده برای درخواست‌های شبکه‌ای مقاوم در برابر اینترنت کند/ناپایدار (فیلترشکن)
// - اگه درخواست بیش از حد طول بکشه، خودش قطعش می‌کنه (timeout)
// - در صورت شکست، چند بار دوباره تلاش می‌کنه قبل از این‌که خطا بده

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) {
        throw err; // تلاش‌ها تموم شد، خطا رو به بیرون پاس بده
      }
      // قبل از تلاش بعدی کمی صبر کن
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
