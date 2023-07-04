import styles from './loader.module.css';

export default function Loader() {
  return (
    <div className={styles.loaderctn}>
      <span className={styles.loader} data-testid="loader"></span>
    </div>
  );
};


