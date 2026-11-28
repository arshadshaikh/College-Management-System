import FeeStatement from '../../components/FeeStatement';
import { PORTAL } from '../../config/app';

// Student: their own fee statement (from My Challans).
export default function MyStatement() {
  return (
    <FeeStatement self endpoint="/my-statement"
      back={{ to: `${PORTAL}/my-challans`, label: 'My Challans' }}
      challanLink={(cid) => `${PORTAL}/my-challans/${cid}`} />
  );
}
