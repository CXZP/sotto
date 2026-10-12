-- Sotto: I2S as a port people can report from a back-panel photo.
-- Run once in the SQL Editor after ports.sql. Safe to re-run.
alter table public.port_reports drop constraint if exists port_reports_ports_in_check;
alter table public.port_reports add constraint port_reports_ports_in_check check (ports_in <@ array['usb', 'coax', 'optical', 'aes', 'i2s', 'bt', 'rca', 'xlr', 'line']);
alter table public.port_reports drop constraint if exists port_reports_ports_out_check;
alter table public.port_reports add constraint port_reports_ports_out_check check (ports_out <@ array['usb', 'coax', 'optical', 'aes', 'i2s', 'bt', 'rca', 'xlr', 'line']);
