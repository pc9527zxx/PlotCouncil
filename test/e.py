import matplotlib.pyplot as plt
import numpy as np

def create_scientific_plot():
    # 1. Setup Figure and Axes
    fig, ax = plt.subplots(figsize=(6, 6.5), facecolor='white')
    
    # Adjust margins to match layout
    plt.subplots_adjust(left=0.18, right=0.95, top=0.92, bottom=0.15)

    # 2. Generate Synthetic Data
    # Time points for scatter
    t_points = np.array([12, 24, 36, 48, 60, 72, 84, 96])
    # Time points for smooth lines
    t_smooth = np.linspace(0, 100, 200)

    # --- Gene A (Squares, Solid Line) ---
    # Model: y = 0.30 * exp(-0.016 * t)
    y_a_smooth = 0.30 * np.exp(-0.016 * t_smooth)
    # Add noise for points
    np.random.seed(42) # For reproducibility
    y_a_points = 0.30 * np.exp(-0.016 * t_points) + np.random.normal(0, 0.015, len(t_points))
    y_a_err = np.random.uniform(0.015, 0.035, len(t_points))
    
    # --- Gene B (Circles, Dashed Line) ---
    # Model: y = 0.20 * exp(-0.022 * t)
    y_b_smooth = 0.20 * np.exp(-0.022 * t_smooth)
    y_b_points = 0.20 * np.exp(-0.022 * t_points) + np.random.normal(0, 0.01, len(t_points))
    y_b_err = np.random.uniform(0.01, 0.03, len(t_points))

    # --- Gene C (Triangles, Dotted Line) ---
    # Model: y = 0.40 * exp(-0.013 * t)
    y_c_smooth = 0.40 * np.exp(-0.013 * t_smooth)
    y_c_points = 0.40 * np.exp(-0.013 * t_points) + np.random.normal(0, 0.01, len(t_points))
    y_c_err_y = np.random.uniform(0.01, 0.02, len(t_points))
    y_c_err_x = np.random.uniform(2, 4, len(t_points)) # Horizontal errors

    # 3. Plot Data Layers
    
    # Gene A: Confidence Interval (Fill Between)
    # Create a visual confidence band around the smooth line
    ci_upper = y_a_smooth + 0.04
    ci_lower = y_a_smooth - 0.04
    # Clip lower to 0 just in case, though not strictly necessary for this range
    ci_lower = np.maximum(ci_lower, 0)
    
    ax.fill_between(t_smooth, ci_lower, ci_upper, color='lightgray', alpha=0.5, zorder=1, linewidth=0)

    # Gene A: Line and Points
    ax.plot(t_smooth, y_a_smooth, 'k-', linewidth=1.5, zorder=2)
    ax.errorbar(t_points, y_a_points, yerr=y_a_err, fmt='s', color='black', 
                markersize=6, capsize=3, elinewidth=1.2, markeredgewidth=1.2, 
                label='gene a', zorder=3)

    # Gene B: Line and Points
    ax.plot(t_smooth, y_b_smooth, 'k--', linewidth=1.5, zorder=2)
    ax.errorbar(t_points, y_b_points, yerr=y_b_err, fmt='o', color='black', 
                markersize=6, capsize=3, elinewidth=1.2, markeredgewidth=1.2, 
                label='gene b', zorder=3)

    # Gene C: Line and Points
    ax.plot(t_smooth, y_c_smooth, 'k:', linewidth=1.5, zorder=2)
    ax.errorbar(t_points, y_c_points, yerr=y_c_err_y, xerr=y_c_err_x, fmt='^', color='black', 
                markersize=6, capsize=3, elinewidth=1.2, markeredgewidth=1.2, 
                label='gene c', zorder=3)

    # 4. Configure Axes
    
    # Limits
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 0.40)
    
    # Ticks
    ax.set_xticks([0, 12, 24, 36, 48, 60, 72, 84, 96])
    ax.set_yticks([0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40])
    
    # Tick params (direction in, size)
    ax.tick_params(direction='in', length=4, width=1, colors='black', top=False, right=False)
    # Note: The image shows ticks only on bottom and left, but standard scientific plots often mirror them. 
    # The image seems to have a box but ticks might only be prominent on left/bottom. 
    # Let's stick to standard box with inward ticks on all sides or just left/bottom. 
    # Looking closely, top and right spines are present. Ticks seem to be on all sides or at least left/bottom.
    # Let's enable ticks on all sides but labels only on left/bottom.
    ax.tick_params(which='both', top=True, right=True, direction='in')

    # Labels
    ax.set_xlabel('time (h)', fontsize=14, fontfamily='sans-serif')
    ax.set_ylabel(r'concentration (mmol cm$^{-3}$)', fontsize=14, fontfamily='sans-serif')

    # Grid (Very faint)
    ax.grid(True, which='major', linestyle='-', linewidth=0.5, color='#EEEEEE', alpha=0.5)

    # 5. Legend
    # Custom legend to match the visual style (markers only, no lines in legend keys)
    handles, labels = ax.get_legend_handles_labels()
    # We want the legend to show the markers, which errorbar handles do by default.
    ax.legend(handles, labels, loc='upper right', frameon=False, fontsize=10, handletextpad=0.1)

    # 6. Annotations
    # The "E" label outside the plot
    ax.text(-0.15, 1.02, 'E', transform=ax.transAxes, fontsize=18, fontweight='normal', va='bottom', ha='right')

    # 7. Final Polish
    for spine in ax.spines.values():
        spine.set_linewidth(1.0)
        spine.set_color('black')

    plt.show()

if __name__ == "__main__":
    create_scientific_plot()