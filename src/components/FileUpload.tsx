import { useState } from 'react';
import { Upload, FileText, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface FileUploadProps {
  onParse: (data: { sourceType: string; text: string; sourceUrl?: string }) => void;
}

export const FileUpload = ({ onParse }: FileUploadProps) => {
  const [activeTab, setActiveTab] = useState('pdf');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
    } else {
      toast.error('Please upload a PDF file');
    }
  };

  const handleParse = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'text') {
        if (!textInput.trim()) {
          toast.error('Please enter some text');
          return;
        }
        onParse({ sourceType: 'text', text: textInput.trim() });
      } else if (activeTab === 'url') {
        if (!urlInput.trim()) {
          toast.error('Please enter a URL');
          return;
        }
        onParse({ sourceType: 'url', text: '', sourceUrl: urlInput.trim() });
      } else if (activeTab === 'pdf') {
        if (!file) {
          toast.error('Please upload a PDF file');
          return;
        }
        
        // Import PDF parser dynamically
        const { extractTextFromPDF, normalizeText } = await import('@/lib/pdfParser');
        
        toast.info('Extracting text from PDF...');
        const rawText = await extractTextFromPDF(file);
        const normalizedText = normalizeText(rawText);
        
        if (normalizedText.length < 100) {
          toast.error('PDF contains too little text. Please try a different file.');
          return;
        }
        
        onParse({ sourceType: 'pdf', text: normalizedText });
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse content');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 shadow-medium">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="pdf" className="gap-2">
            <FileText className="h-4 w-4" />
            PDF
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            Text
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-2">
            <LinkIcon className="h-4 w-4" />
            URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf" className="space-y-4">
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center transition-smooth
              ${isDragging ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'}
            `}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop your PDF here, or click to browse
            </p>
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {file && (
              <p className="text-sm font-medium text-foreground mt-4">
                Selected: {file.name}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="text" className="space-y-4">
          <Textarea
            placeholder="Paste your study material here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="min-h-[300px] resize-none"
          />
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <Input
            type="url"
            placeholder="https://example.com/article"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Enter a URL to fetch and extract text content
          </p>
        </TabsContent>
      </Tabs>

      <Button
        onClick={handleParse}
        disabled={isLoading}
        className="w-full mt-6 gradient-primary hover:opacity-90"
      >
        {isLoading ? 'Parsing...' : 'Parse & Continue'}
      </Button>
    </Card>
  );
};
