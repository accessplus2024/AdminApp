import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover elevation + pointer cursor for clickable cards. */
  interactive?: boolean;
  /** Removes the resting shadow (hairline border only). */
  flat?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export type CardSectionProps = React.HTMLAttributes<HTMLDivElement>;

export declare function Card(props: CardProps): JSX.Element;
export declare function CardHeader(props: CardSectionProps): JSX.Element;
export declare function CardTitle(props: CardSectionProps): JSX.Element;
export declare function CardDescription(props: CardSectionProps): JSX.Element;
export declare function CardBody(props: CardSectionProps): JSX.Element;
export declare function CardFooter(props: CardSectionProps): JSX.Element;
