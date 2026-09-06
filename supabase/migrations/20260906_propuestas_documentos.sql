-- Documentos operativos de una propuesta ya cerrada: el e-ticket del aereo
-- (PDF subido + link opcional a la reserva en la aerolinea) y el voucher del
-- hospedaje (archivo subido + link opcional a la reserva). Uso interno del
-- panel, no se exportan al PDF de cierre que ya recibio el cliente.
alter table propuestas add column if not exists aereo_link text;
alter table propuestas add column if not exists aereo_pdf_url text;
alter table propuestas add column if not exists hospedaje_link text;
alter table propuestas add column if not exists hospedaje_voucher_url text;
