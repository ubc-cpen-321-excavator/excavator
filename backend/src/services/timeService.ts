class TimeService {

    private formatNumberWithSign(num:number): string {

        const posNum = Math.abs(num);

        let formattedNumber = posNum.toString();

        if (this.isSingleDigit(posNum)){
            formattedNumber = this.formatSingleDigit(posNum);
        }

        if (num >= 0) {
            return `+${formattedNumber}`;
        } else if (num < 0) {
            return `-${formattedNumber}`;
        }

        return formattedNumber;
    }

    private formatSingleDigit(digit: number):string {
        return `0${digit}`;
    }

    private isSingleDigit(digit: number):boolean {
        return Math.abs(digit) < 10;
    }

    getTime() {
        const timeOptions: Intl.DateTimeFormatOptions = {
            hour12: false,
        };

        const date = new Date()

        const time = date.toLocaleTimeString(undefined, timeOptions);

        const utcDiff = date.getTimezoneOffset() * -1;

        const offsetHours = utcDiff / 60;
        const offsetMinutes = utcDiff % 60;


        return `${time} GMT${this.formatNumberWithSign(offsetHours)}:${this.isSingleDigit(offsetMinutes) ? this.formatSingleDigit(offsetMinutes) : offsetMinutes}`;
    }

}

export default TimeService;