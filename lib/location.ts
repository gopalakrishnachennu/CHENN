export async function currentLocation(): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.geolocation)
    throw new Error('Location is not available in this browser.');
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Allow location access to detect your current location.')), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }),
  );
  const { latitude, longitude } = position.coords;
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not resolve your current location.');
  const data = await response.json() as { display_name?: string; address?: Record<string, string> };
  const address = data.address ?? {};
  return [address.city || address.town || address.village, address.state, address.country].filter(Boolean).join(', ') || data.display_name || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}
