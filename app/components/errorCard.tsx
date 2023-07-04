import styles from './errorCard.module.css'

export default function ErrorCard() {
    return (
        <div className={styles.errorctn}>
            <img src="/danger.png" alt="Danger" width={"70px"} />
            <span>Server Error</span>
        </div>
    )
}