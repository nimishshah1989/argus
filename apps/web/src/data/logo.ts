import { http } from './client.js';

/** The company logo is the image itself, not JSON: the one write whose body is raw bytes. */
export function putLogo(file: File): Promise<{ logo: string }> {
  return http<{ logo: string }>('/api/v1/company/logo', {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
}
