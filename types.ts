import { ReactNode } from 'react';

export interface BaseProps {
  className?: string;
  children?: ReactNode;
}

export type TeacherAgentRole = 'STYLE' | 'LAYOUT' | 'DATA';
export type ChairAgentRole = 'QA' | 'STRATEGY';

export interface TeacherReview {
  role: TeacherAgentRole;
  findings: string;
}

export interface ChairDecision {
  role: ChairAgentRole;
  summary: string;
  priorityFixes?: string[];
}

export interface AnalysisResult {
  markdown: string; 
  teacherCritique?: string;
  teacherReviews?: TeacherReview[];
  chairFindings?: ChairDecision[];
  qaStatus?: 'APPROVED' | 'NEEDS_REVISION' | 'UNKNOWN';
  riskScore?: number;
  timestamp: number;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // Student Phase
  TEACHER_STYLE_REVIEW = 'TEACHER_STYLE_REVIEW',
  TEACHER_LAYOUT_REVIEW = 'TEACHER_LAYOUT_REVIEW',
  TEACHER_DATA_REVIEW = 'TEACHER_DATA_REVIEW',
  CHAIR_QA = 'CHAIR_QA',
  CHAIR_STRATEGY = 'CHAIR_STRATEGY',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  REFINING = 'REFINING'
}

export interface PlotImage {
  base64: string; 
  previewUrl: string; 
  mimeType: string;
}

// === UNIVERSAL SCHEMA V3 (FORENSIC DETAIL LEVEL) ===

export interface AxisTickSpec {
  visible: boolean;
  direction?: 'in' | 'out' | 'inout'; 
  length?: number; 
  color?: string;
  label_rotation?: number;
  label_font?: { family?: 'serif' | 'sans-serif' | 'monospace'; size?: number; bold?: boolean };
}

export interface GridSpec {
  visible: boolean;
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  opacity?: number; 
}

export interface AnnotationSpec {
  text: string;
  position: { x: number | string; y: number | string; coordinate_space: 'data' | 'axes' };
  style?: { color: string; box_style?: string; arrow?: boolean };
}

export interface PanelSpec {
  id: string; 
  title?: string;
  region_bbox?: [number, number, number, number]; 
  
  coordinate_system: {
    background_color?: string; 
    
    axes: Array<{
      id: string;
      role: string; 
      scale: string; 
      range: { min: number | string; max: number | string };
      label?: { text: string; font_size?: string };
      
      major_ticks?: AxisTickSpec;
      minor_ticks?: AxisTickSpec;
      grid_lines?: GridSpec;
    }>;
  };
  
  data_series: Array<{
    id: string;
    name: string;
    type: string; 
    
    data_points?: Array<{ coordinates: { x: number; y: number }; label?: { text: string } }>;
    geometric_description?: string; 
    
    style: {
      fill?: { color: string; opacity?: number }; 
      stroke?: { color: string; width: number; dash_pattern?: string }; 
      marker?: { 
        type: string; 
        size: number; 
        edge_color?: string; 
        edge_width?: number;
      };
      error_bars?: { visible: boolean };
    };
  }>;

  annotations?: AnnotationSpec[];
  legend?: { visible: boolean; position: string; frame_on: boolean };
}

export interface UniversalPlotSpec {
  meta: {
    chart_type: { primary: string; subtypes?: string[]; composite?: boolean; layout?: string };
    title?: { text: string };
    canvas: { 
      logical_size: { width: number; height: number }; 
      actual_aspect_ratio?: number; 
      background?: string; 
      font_family_hint?: string; 
    };
    // The Teacher's review notes
    teacher_notes?: string;
  };
  
  panels: PanelSpec[]; 
  
  validation: {
    reproducibility_assessment?: any;
    data_completeness?: any;
    estimated_reproduction_accuracy?: number;
  };
  
  python_code?: string;
}

export type PlotAnalysisJSON = UniversalPlotSpec;

export interface PlotSnapshot {
  id: string;
  created: number;
  base64: string;
  seq: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  selectedImage: PlotImage | null;
  result: AnalysisResult | null;
  errorMessage: string;
  plotHistory: PlotSnapshot[];
  renderCount: number;
  generatedPlotBase64: string | null;
  renderLogs: string;
  renderError: string;
}