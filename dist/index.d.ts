type StateType = "New" | "Learning" | "Review" | "Relearning";
declare enum State {
    New = 0,
    Learning = 1,
    Review = 2,
    Relearning = 3
}
type RatingType = "Manual" | "Again" | "Hard" | "Good" | "Easy";
declare enum Rating {
    Manual = 0,
    Again = 1,
    Hard = 2,
    Good = 3,
    Easy = 4
}
type ExcludeManual<T> = Exclude<T, Rating.Manual>;
type Grade = ExcludeManual<Rating>;
interface ReviewLog {
    rating: Rating;
    state: State;
    due: Date;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    last_elapsed_days: number;
    scheduled_days: number;
    review: Date;
}
type RecordLogItem = {
    card: Card;
    log: ReviewLog;
};
type RecordLog = {
    [key in Grade]: RecordLogItem;
};
interface Card {
    due: Date;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: State;
    last_review?: Date;
}
interface CardInput extends Omit<Card, "state" | "due" | "last_review"> {
    state: StateType | State;
    due: DateInput;
    last_review?: DateInput | null;
}
type DateInput = Date | number | string;
interface ReviewLogInput extends Omit<ReviewLog, "rating" | "state" | "due" | "review"> {
    rating: RatingType | Rating;
    state: StateType | State;
    due: DateInput;
    review: DateInput;
}
interface FSRSParameters {
    request_retention: number;
    maximum_interval: number;
    w: number[];
    enable_fuzz: boolean;
}
type RescheduleOptions = {
    enable_fuzz?: boolean;
    dateHandler?: (date: Date) => DateInput;
};

declare class SchedulingCard {
    again: Card;
    hard: Card;
    good: Card;
    easy: Card;
    last_review: Date;
    last_elapsed_days: number;
    private copy;
    constructor(card: Card, now: Date);
    update_state(state: State): this;
    schedule(now: Date, hard_interval: number, good_interval: number, easy_interval: number): SchedulingCard;
    record_log(card: Card, now: Date): RecordLog;
}

declare const default_request_retention = 0.95;
declare const default_maximum_interval = 36500;
declare const default_w: number[];
declare const default_enable_fuzz = true;
declare const FSRSVersion: string;
declare const generatorParameters: (props?: Partial<FSRSParameters>) => FSRSParameters;
/**
 * Create an empty card
 * @param now Current time
 * @param afterHandler Convert the result to another type. (Optional)
 * @example
 * ```
 * const card: Card = createEmptyCard(new Date());
 * ```
 * @example
 * ```
 * interface CardUnChecked
 *   extends Omit<Card, "due" | "last_review" | "state"> {
 *   cid: string;
 *   due: Date | number;
 *   last_review: Date | null | number;
 *   state: StateType;
 * }
 *
 * function cardAfterHandler(card: Card) {
 *      return {
 *       ...card,
 *       cid: "test001",
 *       state: State[card.state],
 *       last_review: card.last_review ?? null,
 *     } as CardUnChecked;
 * }
 *
 * const card: CardUnChecked = createEmptyCard(new Date(), cardAfterHandler);
 * ```
 */
declare function createEmptyCard<R = Card>(now?: DateInput, afterHandler?: (card: Card) => R): R;

type unit = "days" | "minutes";
type int = number & {
    __int__: void;
};
type double = number & {
    __double__: void;
};

declare global {
    export interface Date {
        scheduler(t: int, isDay?: boolean): Date;
        diff(pre: Date, unit: unit): int;
        format(): string;
        dueFormat(last_review: Date, unit?: boolean, timeUnit?: string[]): string;
    }
}
/**
 * 计算日期和时间的偏移，并返回一个新的日期对象。
 * @param now 当前日期和时间
 * @param t 时间偏移量，当 isDay 为 true 时表示天数，为 false 时表示分钟
 * @param isDay （可选）是否按天数单位进行偏移，默认为 false，表示按分钟单位计算偏移
 * @returns 偏移后的日期和时间对象
 */
declare function date_scheduler(now: DateInput, t: number, isDay?: boolean): Date;
declare function date_diff(now: DateInput, pre: DateInput, unit: unit): number;
declare function formatDate(dateInput: DateInput): string;
declare function show_diff_message(due: DateInput, last_review: DateInput, unit?: boolean, timeUnit?: string[]): string;
declare function fixDate(value: unknown): Date;
declare function fixState(value: unknown): State;
declare function fixRating(value: unknown): Rating;
declare const Grades: Readonly<Grade[]>;
declare function get_fuzz_range(interval: number, elapsed_days: number, maximum_interval: number): {
    min_ivl: number;
    max_ivl: number;
};

declare const DECAY: number;
declare const FACTOR: number;
declare class FSRSAlgorithm {
    protected param: FSRSParameters;
    private readonly intervalModifier;
    protected seed?: string;
    constructor(param: Partial<FSRSParameters>);
    init_ds(s: SchedulingCard): void;
    /**
     * Updates the difficulty and stability values of the scheduling card based on the last difficulty,
     * last stability, and the current retrievability.
     * @param {SchedulingCard} s scheduling Card
     * @param {number} last_d Difficulty
     * @param {number} last_s Stability
     * @param retrievability Retrievability
     */
    next_ds(s: SchedulingCard, last_d: number, last_s: number, retrievability: number): void;
    /**
     * The formula used is :
     * S_0(G) = w_{G-1}
     * \max \{S_0,0.1\}
     * @param g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
     * @return Stability (interval when R=90%)
     */
    init_stability(g: Grade): number;
    /**
     * The formula used is :
     * $$D_0(G) = w_4 - (G-3) \cdot w_5$$
     * $$\min \{\max \{D_0(G),1\},10\}$$
     * where the D_0(3)=w_4 when the first rating is good.
     * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
     * @return {number} Difficulty D \in [1,10]
     */
    init_difficulty(g: Grade): number;
    /**
     * If fuzzing is disabled or ivl is less than 2.5, it returns the original interval.
     * @param {number} ivl - The interval to be fuzzed.
     * @param {number} elapsed_days t days since the last review
     * @param {number} enable_fuzz - This adds a small random delay to the new interval time to prevent cards from sticking together and always being reviewed on the same day.
     * @return {number} - The fuzzed interval.
     **/
    apply_fuzz(ivl: number, elapsed_days: number, enable_fuzz?: boolean): int;
    /**
     *  Ref:
     *   constructor(param: Partial<FSRSParameters>)
     *   this.intervalModifier = 9 * (1 / this.param.request_retention - 1);
     *   @param {number} s - Stability (interval when R=90%)
     *   @param {number} elapsed_days t days since the last review
     *   @param {number} enable_fuzz - This adds a small random delay to the new interval time to prevent cards from sticking together and always being reviewed on the same day.
     */
    next_interval(s: number, elapsed_days: number, enable_fuzz?: boolean): int;
    /**
     * The formula used is :
     * $$next_d = D - w_6 \cdot (R - 2)$$
     * $$D^\prime(D,R) = w_5 \cdot D_0(2) +(1 - w_5) \cdot next_d$$
     * @param {number} d Difficulty D \in [1,10]
     * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
     * @return {number} next_D
     */
    next_difficulty(d: number, g: Grade): number;
    /**
     * The formula used is :
     * $$\min \{\max \{D_0,1\},10\}$$
     * @param {number} difficulty D \in [1,10]
     */
    constrain_difficulty(difficulty: number): number;
    /**
     * The formula used is :
     * $$w_7 \cdot init +(1 - w_7) \cdot current$$
     * @param {number} init $$w_2 : D_0(3) = w_2 + (R-2) \cdot w_3= w_2$$
     * @param {number} current $$D - w_6 \cdot (R - 2)$$
     * @return {number} difficulty
     */
    mean_reversion(init: number, current: number): number;
    /**
     * The formula used is :
     * $$S^\prime_r(D,S,R,G) = S\cdot(e^{w_8}\cdot (11-D)\cdot S^{-w_9}\cdot(e^{w_10\cdot(1-R)}-1)\cdot w_15(if G=2) \cdot w_16(if G=4)+1)$$
     * @param {number} d Difficulty D \in [1,10]
     * @param {number} s Stability (interval when R=90%)
     * @param {number} r Retrievability (probability of recall)
     * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
     * @return {number} S^\prime_r new stability after recall
     */
    next_recall_stability(d: number, s: number, r: number, g: Grade): number;
    /**
     * The formula used is :
     * $$S^\prime_f(D,S,R) = w_11\cdot D^{-w_{12}}\cdot ((S+1)^{w_{13}}-1) \cdot e^{w_{14}\cdot(1-R)}.$$
     * @param {number} d Difficulty D \in [1,10]
     * @param {number} s Stability (interval when R=90%)
     * @param {number} r Retrievability (probability of recall)
     * @return {number} S^\prime_f new stability after forgetting
     */
    next_forget_stability(d: number, s: number, r: number): number;
    /**
     * The formula used is :
     * $$R(t,S) = (1 + FACTOR \times \frac{t}{9 \cdot S})^{DECAY},$$
     * @param {number} elapsed_days t days since the last review
     * @param {number} stability Stability (interval when R=90%)
     * @return {number} r Retrievability (probability of recall)
     */
    forgetting_curve(elapsed_days: number, stability: number): number;
}

declare class FSRS extends FSRSAlgorithm {
    constructor(param: Partial<FSRSParameters>);
    private preProcessCard;
    private preProcessDate;
    private preProcessLog;
    /**
     * @param card Card to be processed
     * @param now Current time or scheduled time
     * @param afterHandler Convert the result to another type. (Optional)
     * @example
     * ```
     * const card: Card = createEmptyCard(new Date());
     * const f = fsrs();
     * const recordLog = f.repeat(card, new Date());
     * ```
     * @example
     * ```
     * interface RevLogUnchecked
     *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
     *   cid: string;
     *   due: Date | number;
     *   state: StateType;
     *   review: Date | number;
     *   rating: RatingType;
     * }
     *
     * interface RepeatRecordLog {
     *   card: CardUnChecked; //see method: createEmptyCard
     *   log: RevLogUnchecked;
     * }
     *
     * function repeatAfterHandler(recordLog: RecordLog) {
     *     const record: { [key in Grade]: RepeatRecordLog } = {} as {
     *       [key in Grade]: RepeatRecordLog;
     *     };
     *     for (const grade of Grades) {
     *       record[grade] = {
     *         card: {
     *           ...(recordLog[grade].card as Card & { cid: string }),
     *           due: recordLog[grade].card.due.getTime(),
     *           state: State[recordLog[grade].card.state] as StateType,
     *           last_review: recordLog[grade].card.last_review
     *             ? recordLog[grade].card.last_review!.getTime()
     *             : null,
     *         },
     *         log: {
     *           ...recordLog[grade].log,
     *           cid: (recordLog[grade].card as Card & { cid: string }).cid,
     *           due: recordLog[grade].log.due.getTime(),
     *           review: recordLog[grade].log.review.getTime(),
     *           state: State[recordLog[grade].log.state] as StateType,
     *           rating: Rating[recordLog[grade].log.rating] as RatingType,
     *         },
     *       };
     *     }
     *     return record;
     * }
     * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
     * const f = fsrs();
     * const recordLog = f.repeat(card, new Date(), repeatAfterHandler);
     * ```
     */
    repeat<R = RecordLog>(card: CardInput | Card, now: DateInput, afterHandler?: (recordLog: RecordLog) => R): R;
    get_retrievability: (card: CardInput | Card, now: Date) => undefined | string;
    /**
     *
     * @param card Card to be processed
     * @param log last review log
     * @param afterHandler Convert the result to another type. (Optional)
     * @example
     * ```
     * const now = new Date();
     * const f = fsrs();
     * const emptyCardFormAfterHandler = createEmptyCard(now);
     * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now);
     * const { card, log } = repeatFormAfterHandler[Rating.Hard];
     * const rollbackFromAfterHandler = f.rollback(card, log);
     * ```
     *
     * @example
     * ```
     * const now = new Date();
     * const f = fsrs();
     * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler);  //see method: createEmptyCard
     * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
     * const { card, log } = repeatFormAfterHandler[Rating.Hard];
     * const rollbackFromAfterHandler = f.rollback(card, log, cardAfterHandler);
     * ```
     */
    rollback<R = Card>(card: CardInput | Card, log: ReviewLogInput, afterHandler?: (prevCard: Card) => R): R;
    /**
     *
     * @param card Card to be processed
     * @param now Current time or scheduled time
     * @param reset_count Should the review count information(reps,lapses) be reset. (Optional)
     * @param afterHandler Convert the result to another type. (Optional)
     * @example
     * ```
     * const now = new Date();
     * const f = fsrs();
     * const emptyCard = createEmptyCard(now);
     * const scheduling_cards = f.repeat(emptyCard, now);
     * const { card, log } = scheduling_cards[Rating.Hard];
     * const forgetCard = f.forget(card, new Date(), true);
     * ```
     *
     * @example
     * ```
     * interface RepeatRecordLog {
     *   card: CardUnChecked; //see method: createEmptyCard
     *   log: RevLogUnchecked; //see method: fsrs.repeat()
     * }
     *
     * function forgetAfterHandler(recordLogItem: RecordLogItem): RepeatRecordLog {
     *     return {
     *       card: {
     *         ...(recordLogItem.card as Card & { cid: string }),
     *         due: recordLogItem.card.due.getTime(),
     *         state: State[recordLogItem.card.state] as StateType,
     *         last_review: recordLogItem.card.last_review
     *           ? recordLogItem.card.last_review!.getTime()
     *           : null,
     *       },
     *       log: {
     *         ...recordLogItem.log,
     *         cid: (recordLogItem.card as Card & { cid: string }).cid,
     *         due: recordLogItem.log.due.getTime(),
     *         review: recordLogItem.log.review.getTime(),
     *         state: State[recordLogItem.log.state] as StateType,
     *         rating: Rating[recordLogItem.log.rating] as RatingType,
     *       },
     *     };
     * }
     * const now = new Date();
     * const f = fsrs();
     * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler); //see method:  createEmptyCard
     * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
     * const { card } = repeatFormAfterHandler[Rating.Hard];
     * const forgetFromAfterHandler = f.forget(card, date_scheduler(now, 1, true), false, forgetAfterHandler);
     * ```
     */
    forget<R = RecordLogItem>(card: CardInput | Card, now: DateInput, reset_count?: boolean, afterHandler?: (recordLogItem: RecordLogItem) => R): R;
    /**
     *
     * @param cards scheduled card collection
     * @param options Reschedule options,fuzz is enabled by default.If the type of due is not Date, please implement dataHandler.
     * @example
     * ```typescript
     * type CardType = Card & {
     *     cid: number;
     * };
     * const reviewCard: CardType = {
     *     cid: 1,
     *     due: new Date("2024-03-17 04:43:02"),
     *     stability: 48.26139059062234,
     *     difficulty: 5.67,
     *     elapsed_days: 18,
     *     scheduled_days: 51,
     *     reps: 8,
     *     lapses: 1,
     *     state: State.Review,
     *     last_review: new Date("2024-01-26 04:43:02"),
     * };
     * const f = fsrs();
     * const reschedule_cards = f.reschedule([reviewCard]);
     * ```
     *
     */
    reschedule<T extends CardInput | Card>(cards: Array<T>, options?: RescheduleOptions): Array<T>;
}
/**
 * Create a new instance of TS-FSRS
 * @param params FSRSParameters
 * @example
 * ```typescript
 * const f = fsrs();
 * ```
 * @example
 * ```typescript
 * const params: FSRSParameters = generatorParameters({ maximum_interval: 1000 });
 * const f = fsrs(params);
 * ```
 * @example
 * ```typescript
 * const f = fsrs({ maximum_interval: 1000 });
 * ```
 */
declare const fsrs: (params?: Partial<FSRSParameters>) => FSRS;

export { type Card, type CardInput, DECAY, type DateInput, FACTOR, FSRS, FSRSAlgorithm, type FSRSParameters, FSRSVersion, type Grade, Grades, Rating, type RatingType, type RecordLog, type RecordLogItem, type ReviewLog, type ReviewLogInput, SchedulingCard, State, type StateType, createEmptyCard, date_diff, date_scheduler, default_enable_fuzz, default_maximum_interval, default_request_retention, default_w, type double, fixDate, fixRating, fixState, formatDate, fsrs, generatorParameters, get_fuzz_range, type int, show_diff_message, type unit };
