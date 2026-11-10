{{- define "sdd.name" -}}{{ .Chart.Name | trunc 63 | trimSuffix "-" }}{{- end -}}
{{- define "sdd.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}{{ .Release.Name | trunc 63 | trimSuffix "-" }}{{- else -}}{{ printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}{{- end -}}
{{- end -}}
{{- define "sdd.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
app.kubernetes.io/name: {{ include "sdd.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
{{- define "sdd.selector" -}}
app.kubernetes.io/name: {{ include "sdd.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}
{{- define "sdd.image" -}}{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}{{- end -}}
{{- define "sdd.secretName" -}}{{ .Values.secrets.existingSecret | default (include "sdd.fullname" .) }}{{- end -}}
{{- define "sdd.env" -}}
- name: NODE_ENV
  value: production
- name: HOST
  value: "0.0.0.0"
- name: PORT
  value: "3001"
- name: HOME
  value: /tmp
- name: APP_ORIGIN
  value: {{ .Values.appOrigin | quote }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.existingSecret | default (include "sdd.fullname" .) }}
      key: {{ if .Values.database.existingSecret }}{{ .Values.database.existingSecretKey }}{{ else }}DATABASE_URL{{ end }}
{{- range $key := list "ENCRYPTION_KEY" "BOOTSTRAP_EMAIL" "BOOTSTRAP_PASSWORD" "METRICS_TOKEN" }}
- name: {{ $key }}
  valueFrom:
    secretKeyRef:
      name: {{ include "sdd.secretName" $ }}
      key: {{ $key }}
      optional: {{ ne $key "ENCRYPTION_KEY" }}
{{- end }}
{{- range $name, $value := .Values.env }}
- name: {{ $name }}
  value: {{ $value | quote }}
{{- end }}
{{- end -}}
{{- define "sdd.volumes" -}}
- name: tmp
  emptyDir: { sizeLimit: 1Gi }
- name: runtime
  emptyDir: { sizeLimit: 64Mi }
{{- end -}}
{{- define "sdd.mounts" -}}
- name: tmp
  mountPath: /tmp
- name: runtime
  mountPath: /app/.runtime
{{- end -}}
