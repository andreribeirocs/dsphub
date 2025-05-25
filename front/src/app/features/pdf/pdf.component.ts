import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pdf',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf.component.html',
  styleUrls: ['./pdf.component.scss'],
})
export class PdfComponent {
  private http = inject(HttpClient);

  isUploading = signal(false);
  uploadProgress = signal(0);
  extractedData = signal<any>(null);
  error = signal<string>('');

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.uploadPdf(file);
    }
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadPdf(files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
  }

  private uploadPdf(file: File) {
    if (file.type !== 'application/pdf') {
      this.error.set('Please select a PDF file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    this.isUploading.set(true);
    this.error.set('');
    this.extractedData.set(null);

    // First try debug endpoint to see raw text
    this.http
      .post(`${environment.apiUrl}/pdf/debug`, formData, {
        reportProgress: true,
        observe: 'events',
      })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.Response) {
            console.log('Debug response:', event.body);
          }
        },
        error: (err) => {
          console.error('Debug error:', err);
        },
      });

    // Then process normally
    this.http
      .post(`${environment.apiUrl}/pdf/upload`, formData, {
        reportProgress: true,
        observe: 'events',
      })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadProgress.set(
              Math.round((100 * event.loaded) / event.total)
            );
          } else if (event.type === HttpEventType.Response) {
            console.log('Full response:', event.body);
            this.extractedData.set(event.body);
            this.isUploading.set(false);
            this.uploadProgress.set(0);
          }
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Failed to upload PDF');
          this.isUploading.set(false);
          this.uploadProgress.set(0);
        },
      });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  }

  downloadAsJson() {
    if (!this.extractedData()) return;

    const dataStr = JSON.stringify(this.extractedData(), null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pdf-extraction-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadAsText() {
    if (!this.extractedData()?.extractedData?.text) return;

    const text = this.extractedData().extractedData.text;
    const textBlob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(textBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pdf-text-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadDSPData() {
    const dspData = this.extractedData()?.analysis?.dspSummaryData;
    if (!dspData?.transporters) return;

    // Convert to CSV format
    const headers = [
      'Transporter ID',
      'Delivered',
      'DCR (%)',
      'DNR DPMO',
      'LoR DPMO',
      'POD (%)',
      'CC (%)',
      'CE',
      'CDF (%)',
    ];
    const csvContent = [
      headers.join(','),
      ...dspData.transporters.map((t: any) =>
        [
          t.transporterId,
          t.delivered || 0,
          t.dcr || 0,
          t.dnrDpmo || 0,
          t.lorDpmo || 0,
          t.pod || 0,
          t.cc || 0,
          t.ce || 0,
          t.cdf || 0,
        ].join(',')
      ),
    ].join('\n');

    const csvBlob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dsp-summary-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  getDCRClass(dcr: number | null): string {
    if (dcr === null) return 'text-gray-500';
    if (dcr >= 95) return 'text-green-600 font-semibold';
    if (dcr >= 90) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  }

  getPODClass(pod: number | null): string {
    if (pod === null) return 'text-gray-500';
    if (pod >= 95) return 'text-green-600 font-semibold';
    if (pod >= 90) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  }

  reset() {
    this.extractedData.set(null);
    this.error.set('');
    this.uploadProgress.set(0);
    this.isUploading.set(false);
  }
}
