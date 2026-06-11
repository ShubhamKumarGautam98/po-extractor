const N8N_WEBHOOK_URL = '/webhook/po-extract';

// Convert PDF file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Send PDF to n8n webhook for processing
export async function extractPO(file) {
  try {
    const pdf_base64 = await fileToBase64(file);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdf_base64,
        filename: file.name
      })
    });

    if (!response.ok) {
      throw new Error(`n8n webhook returned ${response.status}`);
    }

    const data = await response.json();

    // Inject the real filename into the response
    if (data.purchase_order) {
      data.purchase_order.source_file = file.name;
    }

    return data;

  } catch (error) {
    return {
      status: 'failed',
      purchase_order: null,
      issues: [
        {
          section: 'network',
          field: 'webhook',
          message: error.message
        }
      ]
    };
  }
}

// Export final JSON as downloadable file
export function downloadJSON(data, filename) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'po_export.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}