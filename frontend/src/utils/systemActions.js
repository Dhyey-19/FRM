const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Triggers full Excel workbook backup download (/api/auth/backup).
 * Extracts server-supplied Content-Disposition filename when available.
 */
export async function downloadExcelBackup() {
  const response = await fetch(`${API_BASE}/auth/backup`, { method: 'GET' });
  if (!response.ok) {
    throw new Error('Failed to download backup file from server.');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'FRM Backup.xlsx';
  if (contentDisposition && contentDisposition.includes('filename=')) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
  return filename;
}

/**
 * Surrenders the application license on the server and clears local session state.
 */
export async function surrenderSoftwareLicense() {
  const response = await fetch(`${API_BASE}/auth/surrender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    let errMsg = 'Failed to surrender license.';
    try {
      const data = await response.json();
      if (data && data.message) errMsg = data.message;
    } catch {
      // Ignore JSON parse fallback
    }
    throw new Error(errMsg);
  }

  localStorage.removeItem('isAppRegistered');
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
  window.location.href = '#/';
  window.location.reload();
}
