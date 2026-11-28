import { useParams } from 'react-router-dom';
import FeeStatement from '../../components/FeeStatement';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';

// Admin: any student's fee statement (from the student's page).
export default function StudentStatement() {
  const { id } = useParams();
  const { hasPrv } = useAuth();
  return (
    <FeeStatement
      endpoint={`/students/${id}/statement`}
      back={{ to: `${PORTAL}/students/${id}`, label: 'Student' }}
      challanLink={hasPrv('challans.show') ? (cid) => `${PORTAL}/challans/${cid}` : null}
    />
  );
}
