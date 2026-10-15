// La pantalla "Operaciones" ahora vive dentro de Agenda (botón "En curso"). Esta ruta
// sigue andando para quien la tenga guardada o tenga permiso solo para "Operaciones".
import OperacionesDelDia from '../../components/admin/OperacionesDelDia.jsx'

export default function OperacionesEnCurso() {
  return <OperacionesDelDia />
}
