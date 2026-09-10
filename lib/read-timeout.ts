// For reads only: a deadline does not cancel a database write.
export async function withReadTimeout<T>(read: Promise<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Loading saved jobs timed out. Check your connection and retry.')), milliseconds);
  });
  try { return await Promise.race([read, timeout]); }
  finally { clearTimeout(timer!); }
}
